#!/usr/bin/env python3
"""Submission store — the site's only write path.

Until this module existed the submit wizard wrote to `localStorage`, which
means we never received a single submission: every listing shown on the site
came from the curated `data/mvp.json`. This store makes the promise on the
pricing card true — a submission that arrives is recorded, reviewable, and
publishable.

Design notes
------------
* One JSON file per submission in `data/submissions/<id>.json`. No database:
  the volume of a directory's intake is tiny, and files survive restarts,
  deploys and backups without a migration story.
* `plan` is an **intent**, not an entitlement. A paid tier stays unpublished
  until `confirm_payment()` records the receipt (`paid_at`). `review("approve")`
  refuses that path: an unpaid Standard / Featured / Pro / ad order must not
  become a public detail page. If the client could set its own status, "free
  instant publishing" would be one curl away.
* One live submission per domain. A directory that accepts the same site
  twice has to explain to the first submitter why the second listing exists.
* Bounded: a hard cap and a per-IP quota, because an unbounded write endpoint
  on a public site is a spam target, not a feature.
"""

import json
import os
import re
import secrets
import threading
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(ROOT, "data", "submissions")
CATALOG = os.path.join(ROOT, "data", "mvp.json")

MAX_SUBMISSIONS = 20000     # hard cap on stored records
PER_IP_HOUR = 5
PER_IP_DAY = 20

NAME_MIN, NAME_MAX = 2, 60
SHORT_MIN, SHORT_MAX = 20, 200
LONG_MIN, LONG_MAX = 120, 4000
MAX_TAGS = 4

GENERIC_LOGO = "assets/img/icons/_generic.svg"

STATUSES = ("pending", "approved", "rejected")
# Paid intents. Approving one of these before confirm_payment would publish
# the dofollow / pin the buyer has not paid for.
PAID_PLANS = ("standard", "featured", "pro", "ad")

_lock = threading.Lock()
_DOMAIN_RE = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$")
_EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s.]{1,64}(\.[^@\s.]{1,63})+$")


class SubmissionError(Exception):
    """A rejection the submitter can act on. `code` maps to a UI message."""

    def __init__(self, code, field=None, detail=None):
        super().__init__(code)
        self.code = code
        self.field = field
        self.detail = detail


# --------------------------------------------------------------------------
# storage primitives
# --------------------------------------------------------------------------
def _read_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001
        return default


def _write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def _path(sid):
    return os.path.join(DIR, sid + ".json")


def _ids():
    try:
        return [f[:-5] for f in os.listdir(DIR) if f.endswith(".json")]
    except OSError:
        return []


def _next_id():
    """Sortable id: date prefix + random tail, so the queue is chronological
    and ids are not guessable."""
    return time.strftime("%Y%m%d") + "-" + secrets.token_hex(3)


# --------------------------------------------------------------------------
# catalog context — categories and tags are a closed set
# --------------------------------------------------------------------------
_CATALOG_CACHE = {"mtime": None, "cats": set(), "tags": set(), "taken": set(),
                  "taken_slugs": set()}


def catalog():
    """Category slugs, tag names and already-listed domains.

    A submission may only pick from what the site can actually render: an
    unknown category raises StopIteration inside build.py's `cat()`, and an
    unknown tag breaks the tag link on the product page.
    """
    try:
        mtime = os.path.getmtime(CATALOG)
    except OSError:
        mtime = None
    if _CATALOG_CACHE["mtime"] != mtime:
        data = _read_json(CATALOG, {}) or {}
        cats = {c.get("slug") for c in data.get("categories", []) if c.get("slug")}
        tags = {t.get("name_en") for t in data.get("tags", []) if t.get("name_en")}
        taken = set()
        slugs = set()
        for tool in data.get("tools", []):
            d = domain_of(tool.get("url") or "")
            if d:
                taken.add(d)
            if tool.get("slug"):
                slugs.add(tool["slug"])
        _CATALOG_CACHE.update({"mtime": mtime, "cats": cats, "tags": tags,
                               "taken": taken, "taken_slugs": slugs})
    return _CATALOG_CACHE


# --------------------------------------------------------------------------
# normalisation
# --------------------------------------------------------------------------
def domain_of(url):
    """Bare registrable host from a URL, or None. Mirrors reports.normalize so
    a submission and an SEO report agree on what "the same site" means."""
    d = (url or "").strip().lower()
    d = re.sub(r"^[a-z]+://", "", d)
    d = d.split("/")[0].split("?")[0].split("#")[0]
    d = d.split("@")[-1].split(":")[0]
    d = re.sub(r"^www\.", "", d).rstrip(".")
    if not d or len(d) > 253:
        return None
    try:
        d = d.encode("idna").decode("ascii")
    except Exception:  # noqa: BLE001
        return None
    return d if _DOMAIN_RE.match(d) else None


def clean_url(raw):
    """Return (absolute_url, domain) or raise. Only http(s) survives: a
    `javascript:` or `data:` URL in a listing is an XSS payload with a
    friendly name."""
    u = (raw or "").strip()
    if not u or len(u) > 300:
        raise SubmissionError("invalid_url", "url")
    if re.search(r"\s", u):
        raise SubmissionError("invalid_url", "url")
    low = u.lower()
    if not (low.startswith("http://") or low.startswith("https://")):
        if "://" in u:                       # ftp://, javascript:, data:
            raise SubmissionError("invalid_url", "url")
        u = "https://" + u
    domain = domain_of(u)
    if not domain:
        raise SubmissionError("invalid_url", "url")
    if domain.endswith(".local") or domain.endswith(".internal"):
        raise SubmissionError("invalid_url", "url")
    return u, domain


_TAG_STRIP = re.compile(r"<[^>]{0,200}>")


def clean_text(raw, field, min_len, max_len, required=True):
    """Third-party text lands in our HTML. Strip tags here so a submission can
    never carry markup into the page, then bound the length."""
    s = _TAG_STRIP.sub(" ", str(raw or ""))
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        if required:
            raise SubmissionError("required", field)
        return ""
    if len(s) < min_len:
        raise SubmissionError("too_short", field)
    if len(s) > max_len:
        s = s[:max_len].rstrip()
    if "http://" in s.lower() or "https://" in s.lower():
        # Links belong in the `url` field; links inside copy are how a listing
        # turns into an advert for something else.
        raise SubmissionError("no_links", field)
    return s


def _slugify(name, domain):
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    base = re.sub(r"-{2,}", "-", base)[:48].strip("-")
    if len(base) < 2:
        # Chinese / non-Latin names produce nothing usable — fall back to the
        # domain, which is always ASCII.
        base = re.sub(r"[^a-z0-9]+", "-", domain.split(".")[0]).strip("-") or "product"
    return base


def _unique_slug(name, domain):
    taken = set(catalog()["taken_slugs"])
    taken |= {r.get("slug") for r in all_records() if r.get("slug")}
    base = _slugify(name, domain)
    slug, n = base, 2
    while slug in taken:
        slug = f"{base}-{n}"
        n += 1
    return slug


# --------------------------------------------------------------------------
# records
# --------------------------------------------------------------------------
def load(sid):
    if not sid or not re.match(r"^\d{8}-[0-9a-f]{6}$", sid):
        return None
    return _read_json(_path(sid), None)


def all_records():
    out = []
    for sid in _ids():
        rec = _read_json(_path(sid), None)
        if rec:
            out.append(rec)
    out.sort(key=lambda r: r.get("created_at") or 0, reverse=True)
    return out


def by_status(status):
    return [r for r in all_records() if r.get("status") == status]


def live_for_domain(domain):
    for rec in all_records():
        if rec.get("domain") == domain and rec.get("status") in ("pending", "approved"):
            return rec
    return None


def recent_ips(ip_hash, since):
    n = 0
    for rec in all_records():
        if rec.get("ip_hash") == ip_hash and int(rec.get("created_at") or 0) >= since:
            n += 1
    return n


def quota_ok(ip_hash):
    now = int(time.time())
    if recent_ips(ip_hash, now - 86400) >= PER_IP_DAY:
        return False, "day"
    if recent_ips(ip_hash, now - 3600) >= PER_IP_HOUR:
        return False, "hour"
    return True, None


def count():
    return len(_ids())


# --------------------------------------------------------------------------
# validation
# --------------------------------------------------------------------------
def validate(payload):
    """Turn a client payload into a clean record body, or raise."""
    if not isinstance(payload, dict):
        raise SubmissionError("bad_payload")
    cat = catalog()

    url, domain = clean_url(payload.get("url"))
    if domain in cat["taken"]:
        raise SubmissionError("already_listed", "url", domain)

    name = clean_text(payload.get("name"), "name", NAME_MIN, NAME_MAX)
    short = clean_text(payload.get("short"), "short", SHORT_MIN, SHORT_MAX)
    long_ = clean_text(payload.get("long"), "long", LONG_MIN, LONG_MAX, required=False)

    category = str(payload.get("category") or "").strip().lower()
    if category not in cat["cats"]:
        raise SubmissionError("bad_category", "category")

    raw_tags = payload.get("tags") or []
    if isinstance(raw_tags, str):
        raw_tags = [t for t in re.split(r"[,\s]+", raw_tags) if t]
    tags = []
    for tg in raw_tags:
        tg = str(tg).strip()
        if tg in cat["tags"] and tg not in tags:
            tags.append(tg)
        if len(tags) >= MAX_TAGS:
            break

    email = str(payload.get("email") or "").strip()
    if email and not _EMAIL_RE.match(email):
        raise SubmissionError("bad_email", "email")

    # "ad" is a weekly placement and the three paid tiers are one-time
    # listings. All of them stay in the same queue because the flow is
    # identical up to payment: someone fills the form, an operator confirms the
    # money, the record is what the invoice is written from. Collapsing them
    # into "free" would bury a paid order in the review queue with no way to
    # tell it apart; collapsing them into each other would have the operator
    # invoice the wrong amount.
    plan = str(payload.get("plan") or "free").strip().lower()
    # "paid" is what the form sent before the ladder grew a Standard tier.
    if plan == "paid":
        plan = "featured"
    if plan not in ("free", "standard", "featured", "pro", "ad"):
        plan = "free"

    logo = str(payload.get("logo") or "").strip()
    if logo and not re.match(r"^https?://", logo, re.I):
        logo = ""

    # An ad order has to remember *which* slot was bought. Without it the
    # operator sees "$29 — weekly ad" in the queue and has no way to know
    # whether to put the customer on the board or in the rail.
    slot = str(payload.get("slot") or "").strip().lower()
    if plan != "ad" or slot not in ("board", "sidebar"):
        slot = ""

    maker = clean_text(payload.get("maker"), "maker", 0, 60, required=False)

    return {
        "url": url,
        "domain": domain,
        "name": name,
        "short": short,
        "long": long_,
        "category": category,
        "tags": tags,
        "email": email,
        "logo": logo,
        "maker": maker,
        "plan": plan,
        "slot": slot,
    }


# --------------------------------------------------------------------------
# write path
# --------------------------------------------------------------------------
def create(payload, ip_hash="", owner=None):
    """Validate, de-duplicate and store a new submission.

    `owner` is the signed-in Google account ({sub, email}) when there is one.
    It is what makes "My submissions" follow a person across browsers; an
    anonymous submission simply has no owner and can only be tracked locally.
    """
    body = validate(payload)

    live = live_for_domain(body["domain"])
    if live:
        raise SubmissionError("duplicate", "url", live.get("id"))

    ok, bucket = quota_ok(ip_hash)
    if not ok:
        raise SubmissionError("rate_limited", None, bucket)

    with _lock:
        if count() >= MAX_SUBMISSIONS:
            raise SubmissionError("closed")
        now = int(time.time())
        sid = _next_id()
        rec = dict(body)
        rec.update({
            "id": sid,
            "slug": _unique_slug(body["name"], body["domain"]),
            "status": "pending",
            "paid_at": None,
            "payment_ref": None,
            "created_at": now,
            "updated_at": now,
            "ip_hash": ip_hash,
            "owner_sub": str((owner or {}).get("sub") or ""),
            "owner_email": str((owner or {}).get("email") or ""),
            "reviewed_at": None,
            "reviewer": None,
            "notes": "",
            # A paid intent is not a payment. It is recorded so the queue can
            # sort revenue-intent first, and it is the only thing the client
            # can influence.
            "awaiting_payment": body["plan"] in ("standard", "featured", "pro", "ad"),
        })
        _write_json(_path(sid), rec)
        return rec


def update(sid, **fields):
    with _lock:
        rec = load(sid)
        if not rec:
            return None
        rec.update(fields)
        rec["updated_at"] = int(time.time())
        _write_json(_path(sid), rec)
        return rec


def update_own(sid, payload, owner=None, admin=False):
    """Edit a listing as its owner.

    Editing a live listing sends it back to `pending`: the whole point of
    review is that what is published is what a person approved, and letting a
    submitter rewrite a live page without re-review is how a directory ends up
    hosting copy nobody read.
    """
    rec = load(sid)
    if not rec:
        raise SubmissionError("not_found")

    owner = owner or {}
    mine = (
        (rec.get("owner_sub") and rec.get("owner_sub") == owner.get("sub"))
        or (rec.get("owner_email") and rec.get("owner_email") == (owner.get("email") or "").lower())
    )
    if not (admin or mine):
        raise SubmissionError("not_your_listing")

    cat = catalog()
    category = str(payload.get("category") or rec.get("category") or "").strip().lower()
    if category not in cat["cats"]:
        raise SubmissionError("bad_category", "category")

    raw_tags = payload.get("tags")
    if raw_tags is None:
        tags = list(rec.get("tags") or [])
    else:
        if isinstance(raw_tags, str):
            raw_tags = [t for t in re.split(r"[,\s]+", raw_tags) if t]
        tags = []
        for tg in raw_tags:
            tg = str(tg).strip()
            if tg in cat["tags"] and tg not in tags:
                tags.append(tg)
            if len(tags) >= MAX_TAGS:
                break

    fields = {
        "name": clean_text(payload.get("name", rec.get("name")), "name", NAME_MIN, NAME_MAX),
        "short": clean_text(payload.get("short", rec.get("short")), "short", SHORT_MIN, SHORT_MAX),
        "long": clean_text(payload.get("long", rec.get("long")), "long", LONG_MIN, LONG_MAX,
                           required=False),
        "category": category,
        "tags": tags,
        "maker": clean_text(payload.get("maker", rec.get("maker")), "maker", 0, 60,
                            required=False),
    }
    logo = payload.get("logo", rec.get("logo"))
    logo = str(logo or "").strip()
    fields["logo"] = logo if (not logo or re.match(r"^https?://", logo, re.I)) else ""

    with _lock:
        rec.update(fields)
        if rec.get("status") == "approved":
            rec["status"] = "pending"
            rec["reviewed_at"] = None
        rec["updated_at"] = int(time.time())
        _write_json(_path(sid), rec)
        return rec


def is_paid_plan(rec):
    return (rec or {}).get("plan") in PAID_PLANS


def payment_cleared(rec):
    """True only after confirm_payment has recorded a receipt."""
    return bool((rec or {}).get("paid_at"))


def publicly_listed(rec):
    """Whether this record may render a public detail page.

    Free listings go public on editorial approve. Paid tiers stay private
    until confirm_payment sets paid_at, even if status was flipped to
    approved by an older build or a direct write.
    """
    if not rec or rec.get("status") != "approved":
        return False
    if is_paid_plan(rec) and not payment_cleared(rec):
        return False
    return True


def review(sid, action, notes="", reviewer="admin"):
    """Approve or reject. Rejecting keeps the record: a domain that was turned
    down must not be able to re-submit the same thing silently.

    Paid tiers cannot be approved here. The public page, and the dofollow
    link on it, wait for confirm_payment.
    """
    if action not in ("approve", "reject"):
        raise SubmissionError("bad_action")
    rec = load(sid)
    if not rec:
        raise SubmissionError("not_found")
    if action == "approve" and is_paid_plan(rec) and not payment_cleared(rec):
        raise SubmissionError("payment_required")
    status = "approved" if action == "approve" else "rejected"
    return update(sid, status=status, notes=str(notes or "")[:500],
                  reviewed_at=int(time.time()), reviewer=reviewer)


def confirm_payment(sid, ref=""):
    """Payment confirmed -> the listing goes live without editorial review.

    This is the only function that approves without a human decision, which is
    exactly what "paid listings skip the queue" should mean.
    """
    rec = load(sid)
    if not rec:
        raise SubmissionError("not_found")
    now = int(time.time())
    return update(sid, paid_at=now, payment_ref=str(ref or "")[:120],
                  status="approved", awaiting_payment=False,
                  reviewed_at=now, reviewer="payment")


# --------------------------------------------------------------------------
# read models
# --------------------------------------------------------------------------
def public(rec):
    """What the submitter may see back. No ip_hash, no reviewer notes."""
    if not rec:
        return None
    return {
        "id": rec.get("id"),
        "status": rec.get("status"),
        "name": rec.get("name"),
        "domain": rec.get("domain"),
        "slug": rec.get("slug"),
        "url": rec.get("url"),
        "short": rec.get("short"),
        "category": rec.get("category"),
        "plan": rec.get("plan"),
        "slot": rec.get("slot") or "",
        "awaiting_payment": rec.get("awaiting_payment", False),
        "created_at": rec.get("created_at"),
        "updated_at": rec.get("updated_at"),
    }


def as_tool(rec):
    """Shape an approved submission like a `data/mvp.json` tool so build.py's
    existing template can render it. One language version: we do not machine
    translate a submitter's copy, so both language trees show their text.

    The logo is generated by us (`/api/avatar/<slug>.svg`) rather than hotlinked
    from the submitter: an external image URL is a tracking pixel we cannot
    vet, and a directory that hotlinks can be made to show anything.
    """
    created = time.strftime("%Y-%m-%d", time.localtime(int(rec.get("created_at") or 0)))
    name = rec.get("name") or ""
    short = rec.get("short") or ""
    long_ = rec.get("long") or short
    slug = rec.get("slug")

    # A community listing's placement is rented exactly like a curated one, but
    # the record has no featured_until column — paid_at is the only timestamp
    # there is. Without this the templates raised KeyError('pin') and every
    # approved submission 404'd: the whole submit → approve → live loop was
    # dead, while the static build kept working, so nothing looked wrong.
    paid = bool(rec.get("paid_at"))
    plan = rec.get("plan") or "free"
    window = {"featured": 7, "pro": 90}.get(plan)
    until = ""
    if paid and window:
        until = time.strftime(
            "%Y-%m-%d",
            time.localtime(int(rec["paid_at"]) + window * 86400))
    today = time.strftime("%Y-%m-%d")
    pinned = bool(until) and until >= today

    return {
        "pin": pinned,
        "slug": slug,
        "name_en": name,
        "name_zh": name,
        "short_en": short,
        "short_zh": short,
        "long_en": long_,
        "long_zh": long_,
        "url": rec.get("url"),
        "logo": f"api/avatar/{slug}.svg",
        "logo_remote": rec.get("logo") or "",
        "category": rec.get("category"),
        "tags": list(rec.get("tags") or []),
        "status": "approved",
        "is_featured": bool(paid and window),
        "is_paid": paid,
        "featured_until": until or None,
        "votes_total": 0,
        "votes_week": 0,
        "created_at": created,
        "maker": rec.get("maker") or rec.get("domain") or "",
        "shots": [],
        "community": True,
        "submission_id": rec.get("id"),
    }


def approved_tools():
    return [as_tool(r) for r in by_status("approved") if publicly_listed(r)]


def find_by_slug(slug):
    for rec in by_status("approved"):
        if rec.get("slug") == slug and publicly_listed(rec):
            return rec
    return None


def stats():
    recs = all_records()
    return {
        "total": len(recs),
        "pending": sum(1 for r in recs if r.get("status") == "pending"),
        "approved": sum(1 for r in recs if publicly_listed(r)),
        "rejected": sum(1 for r in recs if r.get("status") == "rejected"),
        "awaiting_payment": sum(1 for r in recs if r.get("awaiting_payment")),
    }


def writable():
    """Whether the store can actually be written to.

    The site is deployed to a host that may serve from a read-only snapshot.
    If it is, every submission would 500 with no explanation — so this is
    surfaced in /api/health instead, where it can be checked in one request.
    """
    try:
        os.makedirs(DIR, exist_ok=True)
        probe = os.path.join(DIR, ".probe")
        with open(probe, "w", encoding="utf-8") as fh:
            fh.write("1")
        os.remove(probe)
        return True
    except OSError:
        return False
