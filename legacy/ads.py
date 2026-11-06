#!/usr/bin/env python3
"""Weekly ad placements — the thing the pricing page actually sells.

Two slots exist and they are not the same product:

* ``board``   — one row inside the weekly leaderboard, between 3rd and 4th.
* ``sidebar`` — a card at the top of the right rail.

Both are rented by the week, so every record carries ``start``/``end`` and
``active()`` filters on today's date. Expiry is therefore a property of the
data, not of a rebuild: a page rendered tomorrow stops showing an ad whose
window ended today, whether or not anyone ran the build.

Storage is a single JSON file next to the submissions. It is small, read on
every HTML request (cached by mtime), and written only by the admin console.
"""

import json
import os
import re
import time
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
ADS_PATH = os.path.join(DATA, "ads.json")

SLOTS = ("board", "sidebar")
SLOT_LABELS = {
    "board": ("榜单位", "Board slot"),
    "sidebar": ("侧栏位", "Sidebar slot"),
}

NAME_MIN, NAME_MAX = 2, 60
HEAD_MIN, HEAD_MAX = 4, 90
URL_RE = re.compile(r"^https?://[^\s<>\"]+$", re.I)
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class AdError(Exception):
    def __init__(self, code, field=None, detail=None):
        super().__init__(code)
        self.code = code
        self.field = field
        self.detail = detail


# --------------------------------------------------------------------------
# storage
# --------------------------------------------------------------------------
def _read():
    try:
        with open(ADS_PATH, encoding="utf-8") as fh:
            raw = json.load(fh)
    except FileNotFoundError:
        return []
    except (OSError, ValueError):
        # A corrupt file must not take the site down: an empty slot is a
        # missing ad, a 500 is a missing page.
        return []
    if isinstance(raw, dict):
        raw = raw.get("ads") or []
    return [a for a in raw if isinstance(a, dict)]


def _write(rows):
    os.makedirs(DATA, exist_ok=True)
    tmp = ADS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    os.replace(tmp, ADS_PATH)


def _mtime():
    try:
        return os.path.getmtime(ADS_PATH)
    except OSError:
        return 0


def today():
    return time.strftime("%Y-%m-%d")


def _as_date(value):
    if not value or not DATE_RE.match(str(value)):
        return None
    try:
        return time.strptime(str(value), "%Y-%m-%d")
    except ValueError:
        return None


def is_live(ad, day=None):
    """Inside its window and not switched off by an operator."""
    if not ad.get("active", True):
        return False
    day = day or today()
    start = str(ad.get("start") or "")
    end = str(ad.get("end") or "")
    if start and start > day:
        return False
    if end and end < day:
        return False
    return True


def active(slot=None, day=None):
    """Live placements, oldest booking first (so a queue is fair)."""
    rows = [a for a in _read() if is_live(a, day)]
    if slot:
        rows = [a for a in rows if a.get("slot") == slot]
    return sorted(rows, key=lambda a: (a.get("created_at") or 0, a.get("id") or ""))


def all_records():
    return sorted(_read(), key=lambda a: (a.get("created_at") or 0), reverse=True)


# --------------------------------------------------------------------------
# write path
# --------------------------------------------------------------------------
def _clean_text(value, field, lo, hi):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(text) < lo:
        raise AdError("too_short", field)
    if len(text) > hi:
        raise AdError("too_long", field)
    return text


def _clean_url(value, field="url"):
    url = str(value or "").strip()
    if not URL_RE.match(url):
        raise AdError("bad_url", field)
    return url


def validate(payload, ad_id=None):
    slot = str(payload.get("slot") or "").strip().lower()
    if slot not in SLOTS:
        raise AdError("bad_slot", "slot")

    start = str(payload.get("start") or "").strip() or today()
    if not _as_date(start):
        raise AdError("bad_date", "start")
    end = str(payload.get("end") or "").strip()
    if not _as_date(end):
        raise AdError("bad_date", "end")
    if end < start:
        raise AdError("end_before_start", "end")

    logo = str(payload.get("logo") or "").strip()
    if logo and not URL_RE.match(logo):
        logo = ""

    return {
        # A second-resolution timestamp collided whenever two placements were
        # added in the same second — and the second one silently overwrote the
        # first on any id-based lookup.
        "id": ad_id or ("ad-%s-%s" % (time.strftime("%Y%m%d-%H%M%S"), uuid.uuid4().hex[:4])),
        "slot": slot,
        "name": _clean_text(payload.get("name"), "name", NAME_MIN, NAME_MAX),
        "headline": _clean_text(payload.get("headline"), "headline", HEAD_MIN, HEAD_MAX),
        "url": _clean_url(payload.get("url")),
        "logo": logo,
        "start": start,
        "end": end,
        "active": bool(payload.get("active", True)),
        "note": str(payload.get("note") or "").strip()[:200],
    }


def create(payload):
    rows = _read()
    ad = validate(payload)
    ad["created_at"] = int(time.time())
    rows.append(ad)
    _write(rows)
    return ad


def update(ad_id, payload):
    rows = _read()
    for i, ad in enumerate(rows):
        if ad.get("id") == ad_id:
            merged = dict(ad)
            merged.update(payload)
            fresh = validate(merged, ad_id=ad_id)
            fresh["created_at"] = ad.get("created_at") or int(time.time())
            rows[i] = fresh
            _write(rows)
            return fresh
    raise AdError("not_found")


def stop(ad_id):
    """Take a placement down now, keeping the record for the invoice."""
    rows = _read()
    for ad in rows:
        if ad.get("id") == ad_id:
            ad["active"] = False
            ad["stopped_at"] = int(time.time())
            _write(rows)
            return ad
    raise AdError("not_found")


def stats():
    rows = _read()
    live = [a for a in rows if is_live(a)]
    return {
        "total": len(rows),
        "live": len(live),
        "board_live": len([a for a in live if a.get("slot") == "board"]),
        "sidebar_live": len([a for a in live if a.get("slot") == "sidebar"]),
    }
