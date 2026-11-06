#!/usr/bin/env python3
"""Report store for shareable, indexable check pages.

One page per domain (`/seo-check/<domain>`), never one per URL: a directory
that mints a page for every path someone pastes becomes a doorway farm.

The store is a **cache, not a source of truth**. Every file is derived from a
public fetch, so losing it costs a re-fetch and nothing else. That is what
makes it safe to keep on disk next to a static site.

Index policy (see `indexable`): a report only gets a robots-allowed page and a
sitemap entry when it is a real, fetchable page with real text. Everything
else is still viewable but served `noindex,follow`, so a pasted URL cannot
turn into an indexable page by itself.
"""

import json
import os
import re
import threading
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(ROOT, "data", "reports")
BLOCK_FILE = os.path.join(ROOT, "data", "reports-blocklist.json")

MAX_REPORTS = 5000          # hard cap: the store cannot grow into a farm
STALE_AFTER = 60 * 60 * 24 * 14   # 14 days: re-check on view after this
MIN_WORDS = 80              # parked domains / JS shells fall below this
MAX_TITLE = 160

_lock = threading.Lock()
_DOMAIN_RE = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$")


def normalize(domain):
    """`https://www.Example.com/x?y` -> `example.com`, or None if not a domain.

    Only the registrable host is ever used, so two paths on the same site can
    never become two pages.
    """
    d = (domain or "").strip().lower()
    d = re.sub(r"^[a-z]+://", "", d)
    d = d.split("/")[0].split("?")[0].split("#")[0]
    d = d.split("@")[-1].split(":")[0]
    d = re.sub(r"^www\.", "", d)
    d = d.rstrip(".")
    if not d or len(d) > 253:
        return None
    try:
        d = d.encode("idna").decode("ascii")
    except Exception:  # noqa: BLE001 - non-ASCII host we cannot encode
        return None
    if not _DOMAIN_RE.match(d):
        return None
    if d.endswith(".local") or d.endswith(".internal"):
        return None
    return d


def _path(key):
    return os.path.join(DIR, key + ".json")


def _read_json(path, default):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001
        return default


def _write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False)
    os.replace(tmp, path)


# --------------------------------------------------------------------------
# blocklist — the removal path for site owners
# --------------------------------------------------------------------------
def blocklist():
    data = _read_json(BLOCK_FILE, {"domains": [], "updated": None})
    return {normalize(d) for d in data.get("domains", []) if normalize(d)}


def is_blocked(key):
    return key in blocklist()


# --------------------------------------------------------------------------
# quality gate
# --------------------------------------------------------------------------
_SPAM_MARKS = ("http://", "https://", "www.", "buy ", "cheap ", "casino", "viagra",
               "porn", "crypto giveaway")


def _title_ok(title):
    """The audited page's <title> is third-party text. We only republish it
    when it looks like a real product title, never a link or a spam slogan."""
    t = (title or "").strip()
    if not t or len(t) > MAX_TITLE:
        return False
    low = t.lower()
    if any(mark in low for mark in _SPAM_MARKS):
        return False
    if t.count("!") > 3 or t.count("http") > 0:
        return False
    letters = [c for c in t if c.isalpha()]
    if letters and sum(1 for c in letters if c.isupper()) / len(letters) > 0.7:
        return False
    return True


def indexable(report, blocked=None):
    """Should this report get a robots-allowed, sitemapped page?

    Deliberately strict. A pasted URL alone must never mint an indexable page:
    it has to be a real site — fetchable, with a real title, real text, and at
    least one signal that someone actually built a page (a meta description, a
    JSON-LD block, or enough copy to be worth reading).
    """
    if not report or not report.get("ok"):
        return False
    facts = report.get("facts") or {}
    if facts.get("status") != 200:
        return False
    if not _title_ok(facts.get("title") or report.get("title")):
        return False
    words = int(facts.get("words") or 0)
    if words < MIN_WORDS:
        return False
    built_page = (int(facts.get("desc_len") or 0) >= 50
                  or int(facts.get("jsonld_blocks") or 0) > 0
                  or words >= 250)
    if not built_page:
        return False
    if blocked is None:
        blocked = blocklist()
    if (report.get("domain") or "") in blocked:
        return False
    return True


# --------------------------------------------------------------------------
# store
# --------------------------------------------------------------------------
def load(key):
    if not key:
        return None
    return _read_json(_path(key), None)


def save(key, result):
    """Persist one audit result. Returns the stored record (or None)."""
    if not key or not result or not result.get("ok"):
        return None
    with _lock:
        existing = load(key)
        now = int(time.time())
        record = dict(result)
        record["domain"] = key
        record["checked_at"] = now
        record["first_seen"] = (existing or {}).get("first_seen", now)
        record["checks_run"] = int((existing or {}).get("checks_run", 0)) + 1
        if not existing and count() >= MAX_REPORTS:
            return None      # cap reached: keep serving, stop growing
        _write_json(_path(key), record)
        return record


def is_stale(report):
    if not report:
        return True
    return time.time() - int(report.get("checked_at") or 0) > STALE_AFTER


def count():
    try:
        return len([f for f in os.listdir(DIR) if f.endswith(".json")])
    except OSError:
        return 0


def all_keys():
    try:
        return sorted(f[:-5] for f in os.listdir(DIR) if f.endswith(".json"))
    except OSError:
        return []


def recent(n=8, only_indexable=True):
    """Most recently checked domains, for internal links + the sitemap.

    Sorted by file mtime (written on every save) so this stays cheap even with
    thousands of stored reports: we stat, sort, then read only the winners.
    """
    try:
        files = [(f[:-5], os.stat(os.path.join(DIR, f)).st_mtime)
                 for f in os.listdir(DIR) if f.endswith(".json")]
    except OSError:
        return []
    files.sort(key=lambda x: -x[1])
    blocked = blocklist()
    rows = []
    for key, _mtime in files:
        if len(rows) >= n:
            break
        rep = load(key)
        if not rep:
            continue
        if only_indexable and (not indexable(rep, blocked=blocked)):
            continue
        rows.append({
            "domain": key,
            "score": rep.get("score"),
            "grade": rep.get("grade"),
            "checked_at": rep.get("checked_at"),
        })
    return rows


def stats():
    keys = all_keys()
    total = len(keys)
    idx = 0
    scores = []
    for key in keys:
        rep = load(key)
        if not rep:
            continue
        if indexable(rep):
            idx += 1
        if isinstance(rep.get("score"), int):
            scores.append(rep["score"])
    return {
        "total": total,
        "indexable": idx,
        "avg": round(sum(scores) / len(scores)) if scores else None,
    }
