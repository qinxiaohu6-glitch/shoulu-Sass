#!/usr/bin/env python3
"""Static server for the AI Tools Directory MVP.

Why not `python3 -m http.server`? That one is single-threaded: a page with
~20 sub-resources queues them one by one, so a 30 KB page can take 10s+.
This server is threaded, gzips text assets, and caches compressed bytes in
memory, which is what a static directory site needs.
"""

import gzip
import hashlib
import json
import os
import re
import secrets
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "3000"))
HOST = os.environ.get("HOST", "0.0.0.0")


def _load_origin():
    """The origin the static build used, so runtime pages agree with the
    canonical URLs baked into the HTML at build time."""
    try:
        with open(os.path.join(ROOT, "data", "site-origin.txt"), encoding="utf-8") as fh:
            v = fh.read().strip()
        return v if v.startswith("http") else ""
    except OSError:
        return ""


_origin = _load_origin()
if _origin:
    os.environ.setdefault("SITE_BASE", _origin)

ADMIN_TOKEN_FILE = os.path.join(ROOT, "data", "admin-token.txt")
ADMIN_COOKIE = "__wb_admin"


def _admin_token():
    """The site owner's key to /admin.html.

    Read from the environment first so a host can inject it, then from a file
    the server generates once. If neither exists we create one instead of
    falling back to a default password: a predictable default is worse than no
    admin page at all.
    """
    tok = (os.environ.get("ADMIN_TOKEN") or "").strip()
    if tok:
        return tok
    try:
        with open(ADMIN_TOKEN_FILE, encoding="utf-8") as fh:
            tok = fh.read().strip()
        if tok:
            return tok
    except OSError:
        pass
    tok = secrets.token_urlsafe(24)
    try:
        os.makedirs(os.path.dirname(ADMIN_TOKEN_FILE), exist_ok=True)
        with open(ADMIN_TOKEN_FILE, "w", encoding="utf-8") as fh:
            fh.write(tok + "\n")
        os.chmod(ADMIN_TOKEN_FILE, 0o600)
        sys.stderr.write("admin token created at %s\n" % ADMIN_TOKEN_FILE)
    except OSError:
        return ""
    return tok


_ADMIN_TOKEN = _admin_token()


def _xml_escape(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _initials(name):
    """Two glyphs that stand in for the logo. CJK names take the first two
    characters; Latin names take the initials of the first two words."""
    s = (name or "").strip()
    if not s:
        return "?"
    cjk = [c for c in s if "\u4e00" <= c <= "\u9fff"]
    if len(cjk) >= 2:
        return "".join(cjk[:2])
    words = re.findall(r"[A-Za-z0-9]+", s)
    if len(words) >= 2:
        return (words[0][0] + words[1][0]).upper()
    if words:
        return words[0][:2].upper()
    return s[:2].upper()


def _avatar_svg(name, slug):
    """A generated logo for a community listing.

    We do not hotlink the submitter's image: an external URL in a listing is a
    tracking pixel we cannot vet, and it can be swapped for anything after
    review. A deterministic gradient plus initials cannot change under us.
    """
    h = int(hashlib.sha256(slug.encode("utf-8")).hexdigest()[:6], 16)
    hue = h % 360
    hue2 = (hue + 26) % 360
    txt = _xml_escape(_initials(name))
    size = 26 if len(txt) <= 2 else 20
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" '
        'role="img" aria-label="%s">'
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="hsl(%d 74%% 60%%)"/>'
        '<stop offset="1" stop-color="hsl(%d 66%% 44%%)"/>'
        '</linearGradient></defs>'
        '<rect width="64" height="64" rx="14" fill="url(#g)"/>'
        '<text x="32" y="32" text-anchor="middle" dominant-baseline="central" '
        'font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif" '
        'font-size="%d" font-weight="600" fill="#fff" letter-spacing="0.5">%s</text>'
        '</svg>' % (_xml_escape(name), hue, hue2, size, txt)
    )

def _render_ad(slot, ad, lang):
    """One live placement, in the markup the page it lands on expects.

    A board ad is a table row because it sits inside the ranking table; a
    sidebar ad is a card. Both carry rel="sponsored nofollow" — a paid link
    that passed authority would devalue every editorial link on the site, and
    disclosure is the one thing search engines ask for explicitly.
    """
    if not ad:
        return ""
    zh = str(lang).startswith("zh")
    name = _xml_escape(ad.get("name") or "")
    head = _xml_escape(ad.get("headline") or "")
    url = _xml_escape(ad.get("url") or "#")
    tag = "广告" if zh else "Ad"
    cta = "访问" if zh else "Visit"
    rel = 'target="_blank" rel="sponsored nofollow noopener"'

    logo = (ad.get("logo") or "").strip()
    if logo:
        mark = ('<img src="%s" alt="" width="32" height="32" loading="lazy">'
                % _xml_escape(logo))
    else:
        seed = (ad.get("name") or "").encode("utf-8")
        hue = int(hashlib.sha256(seed).hexdigest()[:6], 16) % 360
        mark = ('<span class="ad-mark" style="--h:%d">%s</span>'
                % (hue, _xml_escape(_initials(ad.get("name") or ""))))

    if slot == "board":
        return (
            '<tr class="board-ad">'
            '<td class="rank-num"><span class="ad-flag">AD</span></td>'
            '<td colspan="3">'
            '<a class="board-ad__link" href="%s" %s>'
            '<span class="tool-icon" style="width:32px;height:32px">%s</span>'
            '<span><strong>%s</strong><em>%s</em></span></a>'
            '</td>'
            '<td class="board-ad__cta">'
            '<a class="btn btn--ghost btn--sm" href="%s" %s>%s</a>'
            '</td></tr>'
            % (url, rel, mark, name, head, url, rel, cta))

    return (
        '<a class="rail-ad" href="%s" %s>'
        '<span class="rail-ad__top"><span class="ad-flag">AD</span>'
        '<span class="rail-ad__tag">%s</span></span>'
        '<span class="rail-ad__main">'
        '<span class="tool-icon" style="width:36px;height:36px">%s</span>'
        '<span class="rail-ad__body"><strong>%s</strong><em>%s</em></span>'
        '</span>'
        '<span class="rail-ad__cta">%s %s</span>'
        '</a>'
        % (url, rel, tag, mark, name, head, cta, "→"))


def _notify(rec, kind, note=""):
    """Best-effort transactional mail. Never raises, never blocks the reply."""
    if mail_mod is None or not (rec or {}).get("email"):
        return
    try:
        name = rec.get("name") or "your listing"
        site = _origin or ""
        if kind == "submitted":
            mail_mod.send(rec["email"], "We received %s" % name,
                          mail_mod.submitted(rec, site))
        elif kind == "approved":
            mail_mod.send(rec["email"], "%s is live" % name,
                          mail_mod.approved(rec, site))
        elif kind == "rejected":
            mail_mod.send(rec["email"], "%s was not published" % name,
                          mail_mod.rejected(rec, note, site))
        elif kind == "payment":
            mail_mod.send(rec["email"], "Payment received — %s is live" % name,
                          mail_mod.payment_confirmed(rec, site))
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write("notify failed (%s): %r\n" % (kind, exc))


# Pages we removed. A deploy overwrites files but never deletes the ones that# vanished from the source tree, so without this list the retired settings
# pages keep answering 200 on the server. 410 Gone is the honest answer: the
# page existed and is not coming back, which is also what makes search engines
# drop it faster than a 404.
GONE_PATHS = {
    "/settings/credits.html", "/settings/billing.html",
    "/settings/payments.html", "/settings/ads.html",
    "/zh/settings/credits.html", "/zh/settings/billing.html",
    "/zh/settings/payments.html", "/zh/settings/ads.html",
}

sys.path.insert(0, ROOT)
try:
    import audit as audit_mod
except Exception as _exc:  # noqa: BLE001 - the site must still serve pages
    audit_mod = None
    sys.stderr.write("audit module unavailable: %r\n" % (_exc,))
try:
    import drcheck
except Exception as _exc:  # noqa: BLE001
    drcheck = None
    sys.stderr.write("drcheck module unavailable: %r\n" % (_exc,))
try:
    import reports
    import report_page
    import build as site_build
except Exception as _exc:  # noqa: BLE001
    reports = None
    report_page = None
    site_build = None
    sys.stderr.write("report modules unavailable: %r\n" % (_exc,))

try:
    import submissions as subs_mod
    import tool_page
except Exception as _exc:  # noqa: BLE001
    subs_mod = None
    tool_page = None
    sys.stderr.write("submission modules unavailable: %r\n" % (_exc,))

try:
    import auth as auth_mod
except Exception as _exc:  # noqa: BLE001
    auth_mod = None
    sys.stderr.write("auth module unavailable: %r\n" % (_exc,))

try:
    import ads as ads_mod
except Exception as _exc:  # noqa: BLE001
    ads_mod = None
    sys.stderr.write("ads module unavailable: %r\n" % (_exc,))

try:
    import votes as votes_mod
except Exception as _exc:  # noqa: BLE001
    votes_mod = None
    sys.stderr.write("votes module unavailable: %r\n" % (_exc,))

try:
    import overrides as overrides_mod
except Exception as _exc:  # noqa: BLE001
    overrides_mod = None
    sys.stderr.write("overrides module unavailable: %r\n" % (_exc,))

try:
    import mail as mail_mod
except Exception as _exc:  # noqa: BLE001
    mail_mod = None
    sys.stderr.write("mail module unavailable: %r\n" % (_exc,))

# --- submission intake ---------------------------------------------------
# submissions.py already enforces a per-IP quota over stored records. This is
# the cheaper gate in front of it: a client hammering the endpoint should not
# reach the disk at all.
SUB_WINDOW = 600.0
SUB_MAX = 8
_sub_lock = threading.Lock()
_sub = {}   # ip -> [timestamps]


def _sub_ok(ip):
    now = time.time()
    with _sub_lock:
        hits = [t for t in _sub.get(ip, []) if now - t < SUB_WINDOW]
        if len(hits) >= SUB_MAX:
            _sub[ip] = hits
            return False
        hits.append(now)
        _sub[ip] = hits
        if len(_sub) > 4000:
            for k in [k for k, v in _sub.items() if not v or now - v[-1] > SUB_WINDOW * 2]:
                _sub.pop(k, None)
        return True


IP_SALT_FILE = os.path.join(ROOT, "data", "ip-salt.txt")
_ip_salt = ""


def _ip_hash(ip):
    """Store a salted hash, never the address.

    Submissions keep an ip_hash for quota and abuse review. Keeping the raw IP
    would turn a product directory into a log of who visited whom.
    """
    global _ip_salt
    if not _ip_salt:
        try:
            with open(IP_SALT_FILE, encoding="utf-8") as fh:
                _ip_salt = fh.read().strip()
        except OSError:
            _ip_salt = ""
        if not _ip_salt:
            _ip_salt = secrets.token_hex(16)
            try:
                os.makedirs(os.path.dirname(IP_SALT_FILE), exist_ok=True)
                with open(IP_SALT_FILE, "w", encoding="utf-8") as fh:
                    fh.write(_ip_salt + "\n")
                os.chmod(IP_SALT_FILE, 0o600)
            except OSError:
                pass
    return hashlib.sha256((_ip_salt + ip).encode("utf-8")).hexdigest()[:16]

# --- abuse control -------------------------------------------------------
# /api/audit performs 4 outbound fetches per call, so it needs a cap.
RATE_WINDOW = 60.0
RATE_MAX = 20
_rate_lock = threading.Lock()
_rate = {}  # ip -> [timestamps]

# Creating a *new* report page is a publishing action, so it gets its own,
# much tighter bucket: one pasted URL must not be able to mint pages at will.
NEW_WINDOW = 3600.0
NEW_MAX = 15
_new = {}   # ip -> [timestamps]


def _rate_ok(ip, limit=RATE_MAX):
    now = time.time()
    with _rate_lock:
        hits = [t for t in _rate.get(ip, []) if now - t < RATE_WINDOW]
        if len(hits) >= limit:
            _rate[ip] = hits
            return False
        hits.append(now)
        _rate[ip] = hits
        if len(_rate) > 4000:  # keep the dict from growing forever
            for k in [k for k, v in _rate.items() if not v or now - v[-1] > 600]:
                _rate.pop(k, None)
        return True


def _may_create(ip):
    """Allow a limited number of brand-new report pages per IP per hour."""
    now = time.time()
    with _rate_lock:
        hits = [t for t in _new.get(ip, []) if now - t < NEW_WINDOW]
        if len(hits) >= NEW_MAX:
            _new[ip] = hits
            return False
        hits.append(now)
        _new[ip] = hits
        if len(_new) > 4000:
            for k in [k for k, v in _new.items() if not v or now - v[-1] > NEW_WINDOW * 2]:
                _new.pop(k, None)
        return True


REPORT_RE = re.compile(r"^/(zh/)?seo-check/([^/]+?)(?:\.html)?/?$")

# A product page for a listing that went live after the last build.
COMMUNITY_TOOL_RE = re.compile(r"^/(zh/)?tools/([a-z0-9][a-z0-9-]{0,63})\.html$")

# Injection points left in the static HTML by build.tool_grid(community=...).
COMMUNITY_RE = re.compile(r"<!--community:([a-z]+(?::[a-z0-9-]+)?)-->")

# Ad slots left by build.ads_marker(). Filled from data/ads.json at request
# time, because a weekly placement must go live — and come down — without a
# rebuild.
ADS_RE = re.compile(r"<!--ads:(board|sidebar)-->")

AVATAR_RE = re.compile(r"^/api/avatar/([a-z0-9][a-z0-9-]{0,63})\.svg$")

# Every rejection a submitter can actually act on. `field` in the error tells
# the client which input to mark, so the message and the highlight agree.
SUBMIT_ERRORS = {
    "invalid_url": (400, "这个网址看起来不对，试试 https://your-site.com",
                    "That does not look like a URL. Try https://your-site.com"),
    "required": (400, "必填项还没填。", "A required field is empty."),
    "too_short": (400, "写得再具体一点。", "That is a little too short."),
    "no_links": (400, "简介里不能放链接，链接请填在「网址」一栏。",
                 "No links in the description — use the URL field."),
    "bad_category": (400, "请选择一个分类。", "Pick a category."),
    "bad_email": (400, "邮箱格式不对。", "That email address is not valid."),
    "already_listed": (409, "这个站点已经在目录里了。", "That site is already listed."),
    "duplicate": (409, "这个站点已经提交过了，正在处理中。",
                  "That site has already been submitted and is in the queue."),
    "rate_limited": (429, "提交太频繁了，过一会儿再试。",
                     "Too many submissions — try again later."),
    "closed": (503, "提交暂时关闭。", "Submissions are temporarily closed."),
    "bad_payload": (400, "请求格式不对。", "Bad request."),
    "not_found": (404, "找不到这条提交。", "No such submission."),
    "not_your_listing": (403, "这条提交不属于当前账号。",
                         "That listing belongs to a different account."),
    "signin_required": (401, "登录后才能操作。", "Sign in to continue."),
    "bad_action": (400, "未知的操作。", "Unknown action."),
    "payment_required": (409, "付费档须先确认收款，才能公开详情。",
                         "Confirm payment before a paid listing can go live."),
}

AUDIT_ERRORS = {
    "empty_url": (400, "请输入要检测的网址。", "Enter a URL to check."),
    "invalid_url": (400, "这个网址看起来不对，试试 https://your-site.com",
                    "That does not look like a URL. Try https://your-site.com"),
    "domain_not_found": (404, "域名解析不到，检查一下拼写。",
                         "That domain does not resolve. Check the spelling."),
    "blocked_host": (403, "这个地址不允许检测（内网 / 本机地址）。",
                     "That host is not allowed (private or local address)."),
    "unreachable": (502, "抓不到这个页面，可能超时或被拦截了。",
                    "Could not reach that page. It may be slow or blocking bots."),
}

MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json; charset=utf-8",
}

COMPRESSIBLE = {
    ".html", ".css", ".js", ".json", ".xml", ".txt", ".md", ".svg", ".map",
}

# path -> (mtime, raw_bytes, gz_bytes_or_None)
_cache = {}


def _load(fs_path, ext):
    try:
        st = os.stat(fs_path)
    except OSError:
        return None
    key = fs_path
    hit = _cache.get(key)
    if hit and hit[0] == st.st_mtime and hit[1] == st.st_size:
        return hit[2], hit[3], st.st_mtime
    with open(fs_path, "rb") as fh:
        raw = fh.read()
    gz = None
    if ext in COMPRESSIBLE and len(raw) > 860:
        gz = gzip.compress(raw, 6)
        if len(gz) >= len(raw):
            gz = None
    _cache[key] = (st.st_mtime, st.st_size, raw, gz)
    return raw, gz, st.st_mtime


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "dir-mvp"
    sys_version = ""

    def log_message(self, fmt, *args):  # keep the log quiet but useful
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    # ------------------------------------------------------------------
    # /seo-check/<domain> — one server-rendered page per domain
    # ------------------------------------------------------------------
    def _report_key(self, path):
        m = REPORT_RE.match(path)
        if not m:
            return None, None
        lang = "zh" if m.group(1) else "en"
        key = reports.normalize(m.group(2)) if reports else None
        return key, lang

    def _refresh(self, key):
        """Re-audit in the background; the caller already served the old copy."""
        try:
            result = audit_mod.audit("https://" + key, "en")
            reports.save(key, result)
        except Exception as exc:  # noqa: BLE001 - background best effort
            sys.stderr.write("refresh failed %s: %r\n" % (key, exc))

    def _redirect(self, location, status=301):
        self.send_response(status)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()

    def _cookie(self, name):
        raw = self.headers.get("Cookie") or ""
        for part in raw.split(";"):
            k, _, v = part.strip().partition("=")
            if k == name:
                return v
        return ""

    def _serve_admin(self, parsed):
        """The admin console is owner-only.

        Two gates, because one is not enough: the link is gone from every nav
        (see build.NAV_MORE), and the page itself refuses to render without a
        token. Unauthorised requests get the ordinary 404 — a 403 would confirm
        the page exists and tell a scanner exactly where to aim.
        """
        token = _ADMIN_TOKEN
        if not token:
            return self._not_found()
        given = (parse_qs(parsed.query).get("token") or [""])[0]
        if given:
            if not secrets.compare_digest(given, token):
                return self._not_found()
            self.send_response(302)
            self.send_header("Location", parsed.path)
            self.send_header(
                "Set-Cookie",
                "%s=%s; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000"
                % (ADMIN_COOKIE, token))
            self.send_header("Content-Length", "0")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        cookie = self._cookie(ADMIN_COOKIE)
        if cookie and secrets.compare_digest(cookie, token):
            fs = self._resolve(self.path)
            if fs and self._send(fs):
                return
        return self._not_found()

    def _serve_report(self, key, lang, head_only=False, requested=None):
        canonical = ("/zh" if lang == "zh" else "") + "/seo-check/" + key
        if requested and requested != canonical:
            # /seo-check/x.html and /seo-check/x/ are the same page: one URL only
            return self._redirect(canonical)
        if reports.is_blocked(key):
            # the owner asked to be excluded: take the page out entirely
            return self._not_found(status=410)
        rep = reports.load(key)
        if rep and reports.is_stale(rep):
            # stale-while-revalidate: answer now, refresh behind the request
            threading.Thread(target=self._refresh, args=(key,), daemon=True).start()
        if not rep:
            # first visit for this domain: we have to fetch before we can render
            try:
                rep = reports.save(key, audit_mod.audit("https://" + key, lang))
            except Exception:  # noqa: BLE001 - unreachable / blocked / bad host
                rep = None
        if not rep:
            return self._not_found()
        html = report_page.render(key, lang, rep)
        indexed = reports.indexable(rep)
        self._send_bytes(html.encode("utf-8"), "text/html; charset=utf-8",
                         "public, max-age=600" if indexed else "no-store",
                         head_only=head_only)

    def _sitemap_reports(self):
        origin = (site_build.SITE if site_build else _origin) or _origin
        rows = reports.recent(2000) if reports else []
        parts = []
        for r in rows:
            d = r["domain"]
            lastmod = time.strftime("%Y-%m-%d", time.localtime(r.get("checked_at") or 0))
            alts = (f'\n    <xhtml:link rel="alternate" hreflang="en" href="{origin}/seo-check/{d}"/>'
                    f'\n    <xhtml:link rel="alternate" hreflang="zh-Hans" href="{origin}/zh/seo-check/{d}"/>'
                    f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{origin}/seo-check/{d}"/>')
            parts.append(f'  <url>\n    <loc>{origin}/seo-check/{quote(d)}</loc>{alts}\n'
                         f'    <lastmod>{lastmod}</lastmod><changefreq>weekly</changefreq>'
                         f'<priority>0.5</priority>\n  </url>')
        xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
               '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
               + "\n".join(parts) + "\n</urlset>\n")
        self._send_bytes(xml.encode("utf-8"), "application/xml; charset=utf-8",
                         "public, max-age=3600")

    def _inject_recent(self, fs_path, lang):
        """Fill the empty [data-recent-check] block with real report links.

        The static build cannot know which domains have been checked, so the
        placeholder ships empty and the server fills it. Keeps the links in the
        HTML (crawlable) instead of only in client-side JS.
        """
        try:
            with open(fs_path, "rb") as fh:
                raw = fh.read().decode("utf-8", "replace")
        except OSError:
            return None
        marker = '<div class="recent-check" data-recent-check></div>'
        if marker not in raw:
            return None
        rows = reports.recent(10) if reports else []
        if not rows:
            html = ""
        else:
            zh = lang == "zh"
            # The tool page sits at the language root (/seo-check.html or
            # /zh/seo-check.html), so links stay relative to that root.
            prefix = ""
            chips = "".join(
                f'<li><a href="{prefix}seo-check/{quote(r["domain"])}">'
                f'<span>{r["domain"]}</span><b>{r["score"]}</b></a></li>' for r in rows)
            head = ("最近检测" if zh else "Recently checked")
            sub = ("每个域名一页，同一个站不会因为不同路径重复建页。" if zh
                   else "One page per domain — never one per path.")
            html = (f'<section class="tool-section"><div class="section-head">'
                    f'<div class="section-head__title"><h2>{head}</h2><p>{sub}</p></div></div>'
                    f'<ul class="recent-list">{chips}</ul></section>')
        return raw.replace(marker, html).encode("utf-8")

    def _not_found(self, status=404):
        not_found = os.path.join(ROOT, "404.html")
        if os.path.isfile(not_found):
            self._send(not_found, status=status)
        else:
            self.send_error(status)

    # ------------------------------------------------------------------
    # JSON API
    # ------------------------------------------------------------------
    def _send_json(self, payload, status=200, cache="no-store"):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        accepts = self.headers.get("Accept-Encoding", "").lower()
        encoding = None
        if "gzip" in accepts and len(body) > 860:
            gz = gzip.compress(body, 6)
            if len(gz) < len(body):
                body, encoding = gz, "gzip"
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if encoding:
            self.send_header("Content-Encoding", encoding)
        self.send_header("Vary", "Accept-Encoding")
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _send_bytes(self, body, ctype, cache="no-store", status=200, head_only=False):
        """Send an in-memory payload (generated HTML/XML) with optional gzip."""
        encoding = None
        if "gzip" in (self.headers.get("Accept-Encoding", "") or "").lower() and len(body) > 860:
            gz = gzip.compress(body, 6)
            if len(gz) < len(body):
                body, encoding = gz, "gzip"
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        if encoding:
            self.send_header("Content-Encoding", encoding)
        self.send_header("Vary", "Accept-Encoding")
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if not head_only:
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _client_ip(self):
        """Behind a proxy every request looks like the proxy; prefer XFF."""
        xff = self.headers.get("X-Forwarded-For")
        if xff:
            return xff.split(",")[0].strip()
        return self.address_string()

    def _api_audit(self, query):
        if audit_mod is None:
            return self._send_json(
                {"ok": False, "reason": "service_unavailable",
                 "message": "审计服务未加载 / audit service unavailable"}, 503)
        if not _rate_ok(self._client_ip()):
            return self._send_json(
                {"ok": False, "reason": "rate_limited",
                 "message": "请求太频繁，请稍后再试。/ Too many requests, try again in a minute."},
                429, cache="no-store")
        target = (query.get("url") or [""])[0].strip()
        lang = (query.get("lang") or ["en"])[0]
        try:
            result = audit_mod.audit(target, lang)
        except audit_mod.FetchError as exc:
            reason = str(exc).split(":")[0]
            status, msg_zh, msg_en = AUDIT_ERRORS.get(
                reason, (502, "抓取失败。", "Fetch failed."))
            return self._send_json(
                {"ok": False, "reason": reason, "message_zh": msg_zh,
                 "message_en": msg_en}, status)
        except Exception as exc:  # noqa: BLE001 - never leak a traceback to the client
            sys.stderr.write("audit error: %r\n" % (exc,))
            return self._send_json(
                {"ok": False, "reason": "internal_error",
                 "message": "诊断过程出错了，请重试。"}, 500)
        # Keep the result so /seo-check/<domain> can render instantly instead
        # of re-fetching. New pages are capped per IP so this is not a
        # page-minting endpoint.
        if reports and result.get("ok"):
            key = reports.normalize(target)
            if key:
                if reports.load(key) or _may_create(self._client_ip()):
                    reports.save(key, result)
                result = dict(result, permalink="/seo-check/" + key,
                              indexed=reports.indexable(reports.load(key) or result))
        return self._send_json(result, 200, cache="no-store")

    def _api_dr(self, query):
        if drcheck is None:
            return self._send_json(
                {"ok": False, "reason": "service_unavailable",
                 "message": "DR 服务未加载"}, 503)
        if not _rate_ok(self._client_ip(), limit=40):
            return self._send_json(
                {"ok": False, "reason": "rate_limited"}, 429)
        domain = (query.get("domain") or [""])[0].strip()
        if query.get("force"):
            if not _rate_ok(self._client_ip(), limit=40):
                return self._send_json({"ok": False, "reason": "rate_limited"}, 429)
        result = drcheck.lookup(domain, force=bool(query.get("force")))
        # Honest states are data, not errors: always 200 so the UI can render them.
        return self._send_json(result, 200, cache="public, max-age=3600")

    # ------------------------------------------------------------------
    # submissions
    # ------------------------------------------------------------------
    def _read_json_body(self, limit=65536):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except (TypeError, ValueError):
            return None
        if n <= 0 or n > limit:
            return None
        try:
            raw = self.rfile.read(n)
        except OSError:
            return None
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:  # noqa: BLE001 - malformed JSON is a client error
            return None

    def _submit_err(self, exc):
        status, zh, en = SUBMIT_ERRORS.get(exc.code, (400, "提交失败。", "Submission failed."))
        return self._send_json({"ok": False, "reason": exc.code,
                                "field": getattr(exc, "field", None),
                                "message_zh": zh, "message_en": en}, status)

    def _api_submit(self):
        if subs_mod is None:
            return self._send_json(
                {"ok": False, "reason": "service_unavailable",
                 "message_en": "Submission service unavailable."}, 503)
        ip = self._client_ip()
        if not _sub_ok(ip):
            return self._send_json(
                {"ok": False, "reason": "rate_limited",
                 "message_zh": "提交太频繁了，过一会儿再试。",
                 "message_en": "Too many submissions — try again later."}, 429)
        payload = self._read_json_body()
        if payload is None:
            return self._send_json(
                {"ok": False, "reason": "bad_payload",
                 "message_en": "Bad request body."}, 400)
        try:
            # A signed-in submitter's record is tied to their Google account, so
            # "My submissions" can follow them across browsers. Anonymous
            # submissions still work; they just have no owner.
            me = self._current_user()
            owner = {"sub": me.get("sub"), "email": me.get("email")} if me else None
            rec = subs_mod.create(payload, _ip_hash(ip), owner=owner)
        except subs_mod.SubmissionError as exc:
            return self._submit_err(exc)
        except OSError as exc:
            # Read-only filesystem: say so, because "try again" would be wrong.
            sys.stderr.write("submit storage error: %r\n" % (exc,))
            return self._send_json(
                {"ok": False, "reason": "storage_unavailable",
                 "message_zh": "提交存储暂时不可用，请稍后再试。",
                 "message_en": "Submission storage is unavailable right now."}, 503)
        except Exception as exc:  # noqa: BLE001 - never leak a traceback
            sys.stderr.write("submit error: %r\n" % (exc,))
            return self._send_json(
                {"ok": False, "reason": "internal_error",
                 "message_en": "Something went wrong on our side."}, 500)
        body = {"ok": True}
        body.update(subs_mod.public(rec))
        # The queue position is the honest answer: "pending" means a human
        # still has to look at it, and saying so beats a fake "published".
        body["next"] = ("paid" if rec.get("awaiting_payment") else "review")
        _notify(rec, "submitted")
        return self._send_json(body, 201)

    def _admin_ok(self):
        tok = _ADMIN_TOKEN
        if not tok:
            return False
        given = self._cookie(ADMIN_COOKIE)
        return bool(given) and secrets.compare_digest(given, tok)

    # ------------------------------------------------------------------
    # Google sign-in
    # ------------------------------------------------------------------
    def _current_user(self):
        """The signed-in Google account, or None.

        The cookie is signed, so this is the whole session store: no lookup,
        nothing to keep in sync with the disk.
        """
        if auth_mod is None:
            return None
        return auth_mod.read_session(self._cookie(auth_mod.SESSION_COOKIE))

    def _redirect(self, location, cookies=()):
        self.send_response(302)
        self.send_header("Location", location)
        for c in cookies:
            self.send_header("Set-Cookie", c)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _serve_auth(self, parsed):
        """Three routes: start, callback, logout."""
        if auth_mod is None:
            return self._not_found()
        qs = parse_qs(parsed.query)
        lang_zh = False
        signin = "/sign-in.html"

        if parsed.path == "/auth/google/start":
            target = auth_mod.safe_target((qs.get("next") or [""])[0])
            if not auth_mod.configured():
                # Say it plainly instead of bouncing the user to Google with a
                # client_id of "" and showing them Google's error page.
                return self._redirect(signin + "?auth=unconfigured")
            nonce, cookie = auth_mod.make_state(target)
            try:
                url = auth_mod.authorize_url(nonce)
            except auth_mod.AuthError:
                return self._redirect(signin + "?auth=unconfigured")
            return self._redirect(url, [auth_mod.state_cookie(cookie)])

        if parsed.path == "/auth/google/callback":
            state = (qs.get("state") or [""])[0]
            code = (qs.get("code") or [""])[0]
            err = (qs.get("error") or [""])[0]
            saved = auth_mod.read_state(self._cookie(auth_mod.STATE_COOKIE), state)
            if err or not saved:
                return self._redirect(signin + "?auth=denied",
                                      [auth_mod.clear_state_cookie()])
            if not code:
                return self._redirect(signin + "?auth=denied",
                                      [auth_mod.clear_state_cookie()])
            try:
                user = auth_mod.exchange(code)
            except auth_mod.AuthError as exc:
                sys.stderr.write("oauth exchange failed: %s %s\n"
                                 % (exc.reason, exc.detail[:160]))
                # The reason rides along so the page can tell the owner whether
                # this is a network path problem or a rejected credential.
                return self._redirect(
                    signin + "?auth=failed&why=" + quote(exc.reason, safe=""),
                    [auth_mod.clear_state_cookie()])
            value = auth_mod.make_session(user)
            return self._redirect("/" + saved.get("t", "index.html").lstrip("/"),
                                  [auth_mod.session_cookie(value),
                                   auth_mod.clear_state_cookie()])

        if parsed.path == "/auth/logout":
            target = auth_mod.safe_target((qs.get("next") or [""])[0])
            return self._redirect("/" + target.lstrip("/"),
                                  [auth_mod.clear_session_cookie()])

        return self._not_found()

    def _api_me(self):
        user = self._current_user()
        if not user:
            return self._send_json({"ok": True, "user": None}, 200, cache="no-store")
        return self._send_json({
            "ok": True,
            "user": {
                "email": user.get("email", ""),
                "name": user.get("name", ""),
                "picture": user.get("picture", ""),
            },
        }, 200, cache="no-store")

    def _api_my_submissions(self):
        user = self._current_user()
        if not user or subs_mod is None:
            return self._send_json({"ok": True, "items": []}, 200, cache="no-store")
        items = [subs_mod.public(r) for r in subs_mod.all_records()
                 if r.get("owner_sub") and r.get("owner_sub") == user.get("sub")]
        items.sort(key=lambda r: r.get("created_at") or 0, reverse=True)
        return self._send_json({"ok": True, "items": items}, 200, cache="no-store")


    def _api_admin_review(self):
        if subs_mod is None:
            return self._send_json({"ok": False, "reason": "service_unavailable"}, 503)
        if not self._admin_ok():
            # 404, not 403: the same reason the admin page hides itself.
            return self._send_json({"ok": False, "reason": "not_found"}, 404)
        payload = self._read_json_body()
        if not payload:
            return self._send_json({"ok": False, "reason": "bad_payload"}, 400)
        sid = str(payload.get("id") or "")
        action = str(payload.get("action") or "")
        try:
            if action == "payment":
                # The owner confirmed the money arrived. This is the only path
                # that publishes without an editorial decision.
                rec = subs_mod.confirm_payment(sid, ref=str(payload.get("ref") or ""))
                _notify(rec, "payment")
            else:
                rec = subs_mod.review(sid, action,
                                      notes=str(payload.get("notes") or ""))
                if action == "approve":
                    _notify(rec, "approved")
                elif action == "reject":
                    _notify(rec, "rejected", str(payload.get("notes") or ""))
        except subs_mod.SubmissionError as exc:
            return self._submit_err(exc)
        return self._send_json({"ok": True, "item": subs_mod.public(rec)})

    def _api_admin_list(self, query):
        if subs_mod is None:
            return self._send_json({"ok": False, "reason": "service_unavailable"}, 503)
        if not self._admin_ok():
            return self._send_json({"ok": False, "reason": "not_found"}, 404)
        status = (query.get("status") or [""])[0]
        rows = subs_mod.by_status(status) if status in subs_mod.STATUSES else subs_mod.all_records()
        # The queue needs the submitter's address to reply, so this payload is
        # deliberately richer than the public one — and admin-only.
        items = []
        for r in rows[:200]:
            items.append({
                "id": r.get("id"), "status": r.get("status"), "name": r.get("name"),
                "url": r.get("url"), "domain": r.get("domain"), "slug": r.get("slug"),
                "plan": r.get("plan"), "slot": r.get("slot") or "",
                "category": r.get("category"),
                "short": r.get("short"), "email": r.get("email"),
                "maker": r.get("maker"), "tags": r.get("tags") or [],
                "awaiting_payment": r.get("awaiting_payment", False),
                "paid_at": r.get("paid_at"),
                "created_at": r.get("created_at"), "notes": r.get("notes") or "",
            })
        return self._send_json({"ok": True, "items": items,
                                "stats": subs_mod.stats()})

    def _voter_key(self):
        """Who is voting, in a form we are willing to store.

        The leaderboard's promise is "one vote per signed-in user per week", so
        an anonymous vote cannot be counted — accepting it would make the
        ranking gameable by a refresh loop.
        """
        me = self._current_user()
        if not me:
            return ""
        sub = str(me.get("sub") or "").strip()
        email = str(me.get("email") or "").strip().lower()
        if sub:
            return "sub:" + sub
        return ("email:" + email) if email else ""

    def _api_votes(self, query):
        if votes_mod is None:
            return self._send_json({"ok": False, "reason": "service_unavailable"}, 503)
        week = (query.get("week") or [""])[0].strip()
        if not week:
            week = votes_mod.week_id()
        if not re.match(r"^\d{4}-W\d{2}$", week):
            return self._send_json({"ok": False, "reason": "bad_week"}, 400)
        return self._send_json({"ok": True, "week": week,
                                "counts": votes_mod.counts(week)}, 200,
                               cache="no-store")

    def _api_vote(self):
        if votes_mod is None:
            return self._send_json({"ok": False, "reason": "service_unavailable"}, 503)
        payload = self._read_json_body()
        if not isinstance(payload, dict):
            return self._send_json({"ok": False, "reason": "bad_payload"}, 400)
        voter = self._voter_key()
        if not voter:
            return self._send_json({"ok": False, "reason": "signin_required",
                                    "message_zh": "登录后才能投票。",
                                    "message_en": "Sign in to vote."}, 401)
        slug = str(payload.get("slug") or "").strip()
        week = str(payload.get("week") or "").strip() or votes_mod.week_id()
        if not re.match(r"^\d{4}-W\d{2}$", week):
            week = votes_mod.week_id()
        counts, accepted = votes_mod.cast(week, slug, voter)
        return self._send_json({"ok": True, "week": week, "slug": slug,
                                "accepted": accepted,
                                "votes": counts.get(slug, 0),
                                "counts": counts})

    def _api_my_update(self):
        """Edit one of your own listings.

        Until now the form's edit path wrote to localStorage and stopped
        there — the submitter saw "saved", the server never heard about it.
        """
        if subs_mod is None:
            return self._send_json({"ok": False, "reason": "service_unavailable"}, 503)
        payload = self._read_json_body()
        if not isinstance(payload, dict):
            return self._send_json({"ok": False, "reason": "bad_payload"}, 400)
        me = self._current_user()
        admin = self._admin_ok()
        if not me and not admin:
            return self._send_json({"ok": False, "reason": "signin_required",
                                    "message_zh": "登录后才能修改。",
                                    "message_en": "Sign in to edit."}, 401)
        owner = {"sub": me.get("sub"), "email": (me.get("email") or "").lower()} if me else None
        try:
            rec = subs_mod.update_own(str(payload.get("id") or ""), payload,
                                      owner=owner, admin=admin)
        except subs_mod.SubmissionError as exc:
            return self._submit_err(exc)
        except OSError as exc:
            sys.stderr.write("submission update failed: %r\n" % (exc,))
            return self._send_json({"ok": False, "reason": "storage_unavailable"}, 503)
        return self._send_json({"ok": True, "item": subs_mod.public(rec)})

    def _api_admin_tool(self):
        """Pin / unpin / hide / unhide one curated listing.

        The console's switch used to write localStorage, so the page it
        controlled never changed. This is the server side of that switch.
        """
        if overrides_mod is None:
            return self._send_json({"ok": False, "reason": "service_unavailable"}, 503)
        if not self._admin_ok():
            return self._send_json({"ok": False, "reason": "not_found"}, 404)
        payload = self._read_json_body()
        if not isinstance(payload, dict):
            return self._send_json({"ok": False, "reason": "bad_payload"}, 400)
        slug = str(payload.get("slug") or "").strip()
        action = str(payload.get("action") or "").strip()
        try:
            if action == "pin":
                row = overrides_mod.set_flag(slug, "pin", True,
                                             until=str(payload.get("until") or "")[:10])
            elif action == "unpin":
                row = overrides_mod.set_flag(slug, "pin", False)
            elif action == "hide":
                row = overrides_mod.set_flag(slug, "hidden", True)
            elif action == "unhide":
                row = overrides_mod.set_flag(slug, "hidden", False)
            else:
                return self._send_json({"ok": False, "reason": "bad_action"}, 400)
        except ValueError as exc:
            return self._send_json({"ok": False, "reason": str(exc)}, 400)
        except OSError as exc:
            sys.stderr.write("override write failed: %r\n" % (exc,))
            return self._send_json({"ok": False, "reason": "storage_unavailable"}, 503)
        return self._send_json({"ok": True, "slug": slug, "action": action,
                                "override": row,
                                "note": "rebuild to update lists"})

    def _api_admin_ads(self):
        if ads_mod is None:
            return self._send_json({"ok": False, "reason": "service_unavailable"}, 503)
        if not self._admin_ok():
            return self._send_json({"ok": False, "reason": "not_found"}, 404)
        items = []
        for a in ads_mod.all_records():
            row = dict(a)
            row["live"] = ads_mod.is_live(a)
            items.append(row)
        return self._send_json({"ok": True, "items": items,
                                "stats": ads_mod.stats(),
                                "today": ads_mod.today()})

    def _api_admin_ads_post(self):
        if ads_mod is None:
            return self._send_json({"ok": False, "reason": "service_unavailable"}, 503)
        if not self._admin_ok():
            return self._send_json({"ok": False, "reason": "not_found"}, 404)
        payload = self._read_json_body()
        if not isinstance(payload, dict):
            return self._send_json({"ok": False, "reason": "bad_payload"}, 400)
        action = str(payload.get("action") or "create")
        try:
            if action == "stop":
                ad = ads_mod.stop(str(payload.get("id") or ""))
                return self._send_json({"ok": True, "item": ad})
            ad = ads_mod.create(payload)
            return self._send_json({"ok": True, "item": ad}, 201)
        except ads_mod.AdError as exc:
            return self._send_json({"ok": False, "reason": exc.code,
                                    "field": exc.field}, 400)
        except OSError as exc:
            sys.stderr.write("ad storage error: %r\n" % (exc,))
            return self._send_json({"ok": False, "reason": "storage_unavailable"}, 503)
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write("ad write failed: %r\n" % (exc,))
            return self._send_json({"ok": False, "reason": "internal_error"}, 500)

    # ------------------------------------------------------------------
    # community listings — approved submissions, rendered on demand
    # ------------------------------------------------------------------
    _comm = {"sig": None, "tools": []}

    def _comm_sig(self):
        try:
            d = subs_mod.DIR
            return max((os.path.getmtime(os.path.join(d, f))
                        for f in os.listdir(d) if f.endswith(".json")), default=0)
        except (OSError, AttributeError):
            return 0

    def _approved(self):
        """Approved submissions as tool dicts, rebuilt only when the store
        changes — otherwise every page view re-reads every record."""
        if subs_mod is None:
            return []
        sig = self._comm_sig()
        if self._comm["sig"] != sig:
            try:
                self._comm["tools"] = subs_mod.approved_tools()
            except Exception as exc:  # noqa: BLE001 - a bad record must not 500 the page
                sys.stderr.write("approved_tools failed: %r\n" % (exc,))
                return []
            self._comm["sig"] = sig
        return self._comm["tools"]

    def _community_tools(self, kind):
        tools = self._approved()
        if kind in ("all", "feed"):
            return tools
        if kind.startswith("cat:"):
            slug = kind[4:]
            return [t for t in tools if t.get("category") == slug]
        if kind.startswith("tag:"):
            slug = kind[4:]
            name = None
            for g in (getattr(site_build, "TAGS", None) or []):
                if g.get("slug") == slug:
                    name = g.get("name_en")
                    break
            if not name:
                return []
            return [t for t in tools if name in (t.get("tags") or [])]
        return []

    _marker_cache = {}
    _ads_cache = {"mtime": None, "html": {}}

    def _has_marker(self, fs_path):
        """Which pages actually carry an injection point. Read once per file
        version, not once per request — most pages have no marker at all."""
        try:
            m = os.path.getmtime(fs_path)
        except OSError:
            return False
        hit = self._marker_cache.get(fs_path)
        if hit and hit[0] == m:
            return hit[1]
        try:
            with open(fs_path, "rb") as fh:
                blob = fh.read()
            has = b"<!--community:" in blob or b"<!--ads:" in blob
        except OSError:
            has = False
        self._marker_cache[fs_path] = (m, has)
        return has

    def _ads_html(self, slot, lang):
        """The live placement for one slot, or '' — cached per ads.json mtime."""
        if ads_mod is None:
            return ""
        try:
            mtime = ads_mod._mtime()
        except Exception:  # noqa: BLE001
            mtime = 0
        if self._ads_cache["mtime"] != (mtime, lang):
            rendered = {}
            try:
                for name in ("board", "sidebar"):
                    rows = ads_mod.active(name)
                    rendered[name] = _render_ad(name, rows[0], lang) if rows else ""
            except Exception as exc:  # noqa: BLE001 - an empty slot beats a 500
                sys.stderr.write("ad render failed: %r\n" % (exc,))
                rendered = {"board": "", "sidebar": ""}
            self._ads_cache = {"mtime": (mtime, lang), "html": rendered}
        return self._ads_cache["html"].get(slot, "")

    def _inject_dynamic(self, fs_path, lang):
        """Fill the request-time slots: ads first, then community listings.

        Both are things a static build cannot know — an ad booked this morning
        and a listing approved last night — so they share one read of the page
        rather than two.
        """
        try:
            with open(fs_path, "rb") as fh:
                raw = fh.read().decode("utf-8", "replace")
        except OSError:
            return None
        if "<!--community:" not in raw and "<!--ads:" not in raw:
            return None

        if "<!--ads:" in raw:
            raw = ADS_RE.sub(lambda m: self._ads_html(m.group(1), lang), raw)

        if "<!--community:" in raw and subs_mod and tool_page:
            # Links inside a rendered card are relative to the page they sit on.
            rel = os.path.relpath(fs_path, ROOT).replace(os.sep, "/")
            if lang == "zh" and rel.startswith("zh/"):
                rel = rel[3:]

            def repl(m):
                kind = m.group(1)
                tools = self._community_tools(kind)
                if not tools:
                    return ""
                try:
                    if kind == "feed":
                        return tool_page.feed(tools, lang, rel)
                    return tool_page.cards(tools, lang, rel)
                except Exception as exc:  # noqa: BLE001 - an empty slot beats a 500
                    sys.stderr.write("community render failed (%s): %r\n" % (kind, exc))
                    return ""

            raw = COMMUNITY_RE.sub(repl, raw)

        return raw.encode("utf-8")

    def _serve_community_tool(self, slug, lang, head_only=False):
        rec = subs_mod.find_by_slug(slug) if subs_mod else None
        if not rec:
            return False
        try:
            html = tool_page.render(subs_mod.as_tool(rec), lang)
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write("tool page render failed (%s): %r\n" % (slug, exc))
            return False
        self._send_bytes(html.encode("utf-8"), "text/html; charset=utf-8",
                         "public, max-age=300", head_only=head_only)
        return True

    def _api_avatar(self, slug, head_only=False):
        rec = subs_mod.find_by_slug(slug) if subs_mod else None
        if not rec:
            return self._not_found()
        svg = _avatar_svg(rec.get("name") or slug, slug)
        self._send_bytes(svg.encode("utf-8"), "image/svg+xml",
                         "public, max-age=604800", head_only=head_only)

    def _handle_api(self, parsed):
        if parsed.path == "/api/me":
            self._api_me()
            return True
        if parsed.path == "/api/my/submissions":
            self._api_my_submissions()
            return True
        if parsed.path == "/api/admin/submissions":
            self._api_admin_list(parse_qs(parsed.query))
            return True
        if parsed.path == "/api/admin/ads":
            self._api_admin_ads()
            return True
        if parsed.path == "/api/votes":
            self._api_votes(parse_qs(parsed.query))
            return True
        if parsed.path == "/api/audit":
            self._api_audit(parse_qs(parsed.query))
            return True
        if parsed.path == "/api/dr":
            self._api_dr(parse_qs(parsed.query))
            return True
        if parsed.path == "/api/reports/recent":
            if not reports:
                return self._send_json({"ok": False, "reason": "service_unavailable"}, 503)
            self._send_json({"ok": True, "items": reports.recent(8)}, 200,
                            cache="public, max-age=300")
            return True
        if parsed.path == "/api/health":
            self._send_json({
                "ok": True,
                "audit": audit_mod is not None,
                "dr": drcheck is not None,
                "dr_providers": drcheck.configured() if drcheck else [],
                "reports": reports.stats() if reports else None,
                "submissions": subs_mod.stats() if subs_mod else None,
                "submissions_writable": subs_mod.writable() if subs_mod else None,
                "google_oauth": auth_mod.configured() if auth_mod else None,
            }, 200, cache="no-store")
            return True
        return False

    # Never serve these, whatever the URL says. The whole project directory
    # sits next to the web root, so without this list `/data/admin-token.txt`,
    # `/serve.py` and every stored submission (with submitters' email
    # addresses) are one GET away — which would also make the admin gate
    # pointless, since the token would be downloadable.
    BLOCKED_DIRS = {"data", "deploy"}
    BLOCKED_EXT = {".py", ".pyc", ".json", ".md", ".log", ".sh", ".bak",
                   ".tmp", ".env", ".yml", ".yaml", ".toml", ".ini", ".sqlite",
                   ".conf", ".service"}

    def _resolve(self, raw_path):
        path = unquote(urlparse(raw_path).path)
        if "\x00" in path:
            return None
        parts = [p for p in path.split("/") if p]
        if any(p.startswith(".") for p in parts):
            return None                       # .env, .git, .DS_Store
        if parts and parts[0].lower() in self.BLOCKED_DIRS:
            return None
        fs = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        if not (fs == ROOT or fs.startswith(ROOT + os.sep)):
            return None  # traversal attempt
        if os.path.splitext(fs)[1].lower() in self.BLOCKED_EXT:
            return None
        if os.path.isdir(fs):
            fs = os.path.join(fs, "index.html")
        return fs

    def _send(self, fs_path, status=200, head_only=False):
        ext = os.path.splitext(fs_path)[1].lower()
        loaded = _load(fs_path, ext)
        if loaded is None:
            return False
        raw, gz, mtime = loaded
        body = raw
        encoding = None
        accepts = self.headers.get("Accept-Encoding", "")
        if gz is not None and "gzip" in accepts.lower():
            body, encoding = gz, "gzip"

        self.send_response(status)
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        if encoding:
            self.send_header("Content-Encoding", encoding)
        self.send_header("Vary", "Accept-Encoding")
        if ext in (".html", ".xml", ".txt"):
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        if not head_only:
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass
        return True

    @staticmethod
    def _strip_lang(parsed):
        """`/zh/api/...` is the same endpoint as `/api/...`.

        The client builds URLs from a page-relative root, so on the Chinese
        tree every fetch resolved to `/zh/api/submit` — which 404'd, meaning
        nobody using the Chinese site could submit a product or vote. The
        client is fixed too, but an alias here means a cached app.js cannot
        break the site again.
        """
        if parsed.path.startswith("/zh/api/"):
            return parsed._replace(path=parsed.path[3:])
        return parsed

    def do_GET(self):
        parsed = self._strip_lang(urlparse(self.path))
        if parsed.path in GONE_PATHS:
            self._not_found(status=410)
            return
        # An unpublished listing keeps its file on disk (a static build never
        # deletes), so the only way to take it down is here. 410 rather than
        # 404: the page existed and we chose to remove it.
        tm = re.match(r"^/(?:zh/)?tools/([a-z0-9][a-z0-9-]{0,63})\.html$", parsed.path)
        if tm and overrides_mod and overrides_mod.hidden(tm.group(1)):
            self._not_found(status=410)
            return
        if parsed.path in ("/admin.html", "/zh/admin.html"):
            self._serve_admin(parsed)
            return
        if parsed.path in ("/auth/google/start", "/auth/google/callback", "/auth/logout"):
            self._serve_auth(parsed)
            return
        av = AVATAR_RE.match(parsed.path)
        if av:
            self._api_avatar(av.group(1))
            return
        if parsed.path.startswith("/api/") and self._handle_api(parsed):
            return
        if parsed.path == "/sitemap-reports.xml" and reports:
            self._sitemap_reports()
            return
        if reports and report_page and audit_mod:
            key, lang = self._report_key(parsed.path)
            if key:
                self._serve_report(key, lang, requested=parsed.path)
                return
            if REPORT_RE.match(parsed.path):
                self._not_found()   # looked like a report but the domain is invalid
                return
        # A listing approved after the last build has no static file. Render it
        # with the build's own template rather than 404ing the backlink we just
        # promised — but never shadow a file that does exist.
        cm = COMMUNITY_TOOL_RE.match(parsed.path)
        if cm and subs_mod and tool_page and site_build:
            fs_try = self._resolve(parsed.path)
            if not (fs_try and os.path.isfile(fs_try)):
                lang = "zh" if cm.group(1) else "en"
                if self._serve_community_tool(cm.group(2), lang):
                    return
        fs = self._resolve(self.path)
        if fs and reports and fs.endswith(os.sep + "seo-check.html"):
            lang = "zh" if (os.sep + "zh" + os.sep) in fs else "en"
            body = self._inject_recent(fs, lang)
            if body:
                self._send_bytes(body, "text/html; charset=utf-8", "public, max-age=120")
                return
        if fs and fs.endswith(".html") and self._has_marker(fs):
            lang = "zh" if (os.sep + "zh" + os.sep) in fs else "en"
            body = self._inject_dynamic(fs, lang)
            if body:
                self._send_bytes(body, "text/html; charset=utf-8", "public, max-age=60")
                return
        if fs and self._send(fs):
            return
        self._not_found()

    def do_POST(self):
        parsed = self._strip_lang(urlparse(self.path))
        if parsed.path == "/api/submit":
            self._api_submit()
            return
        if parsed.path == "/api/admin/review":
            self._api_admin_review()
            return
        if parsed.path == "/api/admin/ads":
            self._api_admin_ads_post()
            return
        if parsed.path == "/api/vote":
            self._api_vote()
            return
        if parsed.path == "/api/admin/tool":
            self._api_admin_tool()
            return
        if parsed.path == "/api/my/submissions/update":
            self._api_my_update()
            return
        self._send_json({"ok": False, "reason": "not_found"}, 404)

    def do_HEAD(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/admin.html", "/zh/admin.html"):
            self.send_error(404)   # never confirm the console exists
            return
        if AVATAR_RE.match(parsed.path):
            av = AVATAR_RE.match(parsed.path)
            self._api_avatar(av.group(1), head_only=True)
            return
        if reports and report_page and audit_mod:
            key, lang = self._report_key(parsed.path)
            if key:
                self._serve_report(key, lang, head_only=True, requested=parsed.path)
                return
        cm = COMMUNITY_TOOL_RE.match(parsed.path)
        if cm and subs_mod and tool_page and site_build:
            fs_try = self._resolve(parsed.path)
            if not (fs_try and os.path.isfile(fs_try)):
                lang = "zh" if cm.group(1) else "en"
                if self._serve_community_tool(cm.group(2), lang, head_only=True):
                    return
        fs = self._resolve(self.path)
        if fs and self._send(fs, head_only=True):
            return
        self.send_error(404)


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    sys.stderr.write("serving %s on http://%s:%d\n" % (ROOT, HOST, PORT))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
