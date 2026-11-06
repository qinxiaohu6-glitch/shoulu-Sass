"""Google OAuth 2.0 (authorization code) and signed session cookies.

Why a cookie session and not a users table: this site is a file-backed static
build served by one Python process. A signed cookie means there is no session
store to lose on redeploy, no migration, and no second source of truth for
"who is this". The only thing the server must keep is the signing secret.

Credentials, in order of precedence:
    GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI   (env)
    data/google-oauth.json  {"client_id": ..., "client_secret": ...,
                             "redirect_uri": ...}                   (file)
The file wins over nothing else and is the path the deploy can carry, because
the hosting panel has no place to paste env vars.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")

SESSION_COOKIE = "__wb_uid"
STATE_COOKIE = "__wb_oauth"
SESSION_TTL = 30 * 86400          # 30 days
STATE_TTL = 600                   # 10 minutes: enough to pick an account

# Only for local runs over plain http; production must keep Secure on.
_COOKIE_SECURE = "" if os.environ.get("AUTH_INSECURE_COOKIES") == "1" else "; Secure"

# Overridable so the flow can be exercised against a local stub identity
# provider; production never sets these.
AUTH_URL = os.environ.get("GOOGLE_AUTH_URL", "https://accounts.google.com/o/oauth2/v2/auth")
TOKEN_URL = os.environ.get("GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com/token")
ISSUERS = ("accounts.google.com", "https://accounts.google.com")

_lock = threading.Lock()


class AuthError(Exception):
    """Anything that should become a redirect back to sign-in with a reason."""

    def __init__(self, reason, detail=""):
        super().__init__(reason)
        self.reason = reason
        self.detail = detail


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------
def _b64e(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64d(txt):
    pad = "=" * (-len(txt) % 4)
    return base64.urlsafe_b64decode(txt + pad)


def _secret():
    """Signing key, generated once and kept out of the web root."""
    path = os.path.join(DATA, "session-secret.txt")
    with _lock:
        try:
            with open(path, encoding="utf-8") as fh:
                val = fh.read().strip()
            if len(val) >= 32:
                return val.encode("utf-8")
        except OSError:
            pass
        val = secrets.token_hex(32)
        try:
            os.makedirs(DATA, exist_ok=True)
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                fh.write(val)
        except OSError:
            pass
        return val.encode("utf-8")


def _sign(payload_b64):
    return _b64e(hmac.new(_secret(), payload_b64.encode("ascii"), hashlib.sha256).digest())


def _seal(obj):
    raw = json.dumps(obj, separators=(",", ":"), sort_keys=True).encode("utf-8")
    body = _b64e(raw)
    return body + "." + _sign(body)


def _unseal(value):
    if not value or "." not in value:
        return None
    body, sig = value.rsplit(".", 1)
    try:
        expect = _sign(body)
    except Exception:  # noqa: BLE001 - a broken cookie is just "no session"
        return None
    if not hmac.compare_digest(sig, expect):
        return None
    try:
        obj = json.loads(_b64d(body).decode("utf-8"))
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(obj, dict):
        return None
    if int(obj.get("exp") or 0) <= int(time.time()):
        return None
    return obj


# --------------------------------------------------------------------------
# configuration
# --------------------------------------------------------------------------
def _origin():
    try:
        with open(os.path.join(DATA, "site-origin.txt"), encoding="utf-8") as fh:
            origin = fh.read().strip()
        if origin.startswith("http"):
            return origin.rstrip("/")
    except OSError:
        pass
    return "https://dirtool.com"


def config():
    """Return the OAuth client config, or None when the site is not set up."""
    cid = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    sec = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    uri = os.environ.get("GOOGLE_REDIRECT_URI", "").strip()
    if not (cid and sec):
        try:
            with open(os.path.join(DATA, "google-oauth.json"), encoding="utf-8") as fh:
                conf = json.load(fh)
            cid = str(conf.get("client_id") or "").strip()
            sec = str(conf.get("client_secret") or "").strip()
            uri = str(conf.get("redirect_uri") or uri).strip()
        except (OSError, ValueError):
            return None
    if not (cid and sec):
        return None
    return {
        "client_id": cid,
        "client_secret": sec,
        "redirect_uri": uri or (_origin() + "/auth/google/callback"),
    }


def configured():
    return config() is not None


# --------------------------------------------------------------------------
# session cookie
# --------------------------------------------------------------------------
def make_session(user):
    now = int(time.time())
    return _seal({
        "sub": user.get("sub", ""),
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "picture": user.get("picture", ""),
        "iat": now,
        "exp": now + SESSION_TTL,
    })


def read_session(cookie_value):
    obj = _unseal(cookie_value)
    if not obj or not obj.get("sub"):
        return None
    return obj


# --------------------------------------------------------------------------
# state cookie: the CSRF nonce plus where to land afterwards
# --------------------------------------------------------------------------
SAFE_TARGET = None  # compiled lazily below
SAFE_PATH = None
SAFE_QUERY = None


def safe_target(raw):
    """Only allow a same-site .html path with an optional query string.

    The path and the query are checked separately on purpose: a query value may
    legitimately contain a URL (`submit.html?url=https://acme.test`), so the
    protocol-relative check has to apply to the path only. Checking the whole
    string would reject the exact case this site needs most.
    """
    import re
    global SAFE_TARGET, SAFE_PATH, SAFE_QUERY
    if SAFE_PATH is None:
        SAFE_PATH = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._\-/]*\.html$")
        SAFE_QUERY = re.compile(r"^[A-Za-z0-9._~%!$&'()*+,;=:/?@\-]*$")

    target = str(raw or "").strip()
    if not target or len(target) > 400:
        return "index.html"
    if "\\" in target or "\x00" in target:
        return "index.html"
    if target.startswith("/"):
        return "index.html"          # never absolute, never protocol-relative
    path, sep, query = target.partition("?")
    if "//" in path or ":" in path:
        return "index.html"
    if ".." in path.split("/"):
        return "index.html"
    if not SAFE_PATH.match(path):
        return "index.html"
    if sep and (not query or not SAFE_QUERY.match(query)):
        return "index.html"
    return target


def make_state(target):
    now = int(time.time())
    nonce = secrets.token_urlsafe(18)
    value = _seal({"n": nonce, "t": safe_target(target), "exp": now + STATE_TTL})
    return nonce, value


def read_state(cookie_value, nonce):
    obj = _unseal(cookie_value)
    if not obj:
        return None
    if not hmac.compare_digest(str(obj.get("n") or ""), str(nonce or "")):
        return None
    return obj


# --------------------------------------------------------------------------
# the two network steps
# --------------------------------------------------------------------------
def authorize_url(state):
    conf = config()
    if not conf:
        raise AuthError("unconfigured")
    params = {
        "client_id": conf["client_id"],
        "redirect_uri": conf["redirect_uri"],
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
        "include_granted_scopes": "true",
    }
    return AUTH_URL + "?" + urllib.parse.urlencode(params)


def exchange(code):
    """Swap the code for tokens and return the identity claims."""
    conf = config()
    if not conf:
        raise AuthError("unconfigured")
    body = urllib.parse.urlencode({
        "code": code,
        "client_id": conf["client_id"],
        "client_secret": conf["client_secret"],
        "redirect_uri": conf["redirect_uri"],
        "grant_type": "authorization_code",
    }).encode("utf-8")
    req = urllib.request.Request(TOKEN_URL, data=body, method="POST", headers={
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "User-Agent": "product-atlas/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        # Google answered and refused. Split the refusal into the three cases
        # that mean different things to whoever is wiring this up: a stale
        # code (normal), a wrong secret, or a redirect_uri that does not match
        # the one registered for this client.
        detail = ""
        try:
            detail = exc.read().decode("utf-8", "replace")[:300]
        except Exception:  # noqa: BLE001
            pass
        reason = "token_rejected"
        try:
            err = str(json.loads(detail).get("error") or "")
            reason = {
                "invalid_grant": "bad_code",
                "invalid_client": "bad_client",
                "redirect_uri_mismatch": "redirect_mismatch",
                "unauthorized_client": "bad_client",
            }.get(err, "google_" + err[:24] if err else reason)
        except Exception:  # noqa: BLE001
            pass
        raise AuthError(reason, "HTTP %s %s" % (exc.code, detail))
    except urllib.error.URLError as exc:
        # Never reached Google at all: DNS, firewall, blocked egress.
        raise AuthError("network", repr(exc.reason))
    except Exception as exc:  # noqa: BLE001
        raise AuthError("network", repr(exc))

    id_token = payload.get("id_token")
    if not id_token:
        raise AuthError("no_id_token")
    return claims_from_id_token(id_token, conf["client_id"])


def claims_from_id_token(id_token, client_id):
    """Read the claims and check the three things that matter.

    The signature is deliberately not verified: this token came straight from
    Google's token endpoint over TLS in the same request that carried our
    client secret, which is the case Google documents as not needing local
    verification. aud/iss/exp are still checked, because those catch a token
    minted for a different client or replayed later.
    """
    try:
        parts = id_token.split(".")
        if len(parts) < 2:
            raise ValueError("not a jwt")
        claims = json.loads(_b64d(parts[1]).decode("utf-8"))
    except Exception:  # noqa: BLE001
        raise AuthError("bad_id_token")

    if claims.get("aud") != client_id:
        raise AuthError("audience_mismatch")
    if claims.get("iss") not in ISSUERS:
        raise AuthError("issuer_mismatch")
    if int(claims.get("exp") or 0) <= int(time.time()):
        raise AuthError("token_expired")
    if not claims.get("sub"):
        raise AuthError("no_subject")
    if claims.get("email") and claims.get("email_verified") is False:
        raise AuthError("email_unverified")

    return {
        "sub": str(claims["sub"]),
        "email": str(claims.get("email") or ""),
        "name": str(claims.get("name") or ""),
        "picture": str(claims.get("picture") or ""),
    }


# --------------------------------------------------------------------------
# cookies
# --------------------------------------------------------------------------
def session_cookie(value, max_age=SESSION_TTL):
    return ("%s=%s; Path=/; Max-Age=%d; HttpOnly%s; SameSite=Lax"
            % (SESSION_COOKIE, value, max_age, _COOKIE_SECURE))


def clear_session_cookie():
    return ("%s=; Path=/; Max-Age=0; HttpOnly%s; SameSite=Lax"
            % (SESSION_COOKIE, _COOKIE_SECURE))


def state_cookie(value):
    return ("%s=%s; Path=/; Max-Age=%d; HttpOnly%s; SameSite=Lax"
            % (STATE_COOKIE, value, STATE_TTL, _COOKIE_SECURE))


def clear_state_cookie():
    return ("%s=; Path=/; Max-Age=0; HttpOnly%s; SameSite=Lax"
            % (STATE_COOKIE, _COOKIE_SECURE))


def parse_cookies(header):
    out = {}
    for chunk in str(header or "").split(";"):
        if "=" not in chunk:
            continue
        k, v = chunk.split("=", 1)
        k = k.strip()
        if k:
            out[k] = v.strip()
    return out
