#!/usr/bin/env python3
"""Weekly votes — the thing the leaderboard claims to be ranked by.

One vote per signed-in account per product per ISO week. The week is the key,
which is what makes "resets every Monday" true instead of decorative: last
week's file stays on disk as history, and this week starts empty.

Storage is one small JSON file per week:

    data/votes/2026-W45.json  ->  {"claude": ["sub:123", "sub:456"], ...}

Voter keys are the Google `sub` (falling back to the email). We never store the
address itself here — the submissions store already holds the hash it needs.
"""

import json
import os
import re
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, "data", "votes")

_lock = threading.Lock()
_cache = {"week": None, "mtime": 0, "data": {}}


def week_id(ts=None):
    """ISO week id, e.g. '2026-W45'. Weeks run Monday → Sunday.

    `%G-W%V` is the ISO year/week pair, which is what the leaderboard means by
    "resets every Monday" — calendar-year strftime would put Jan 1 in the wrong
    week half the time.
    """
    st = time.localtime(ts) if ts else time.localtime()
    return time.strftime("%G-W%V", st)


def _path(week):
    return os.path.join(DIR, "%s.json" % week)


def _read(week):
    try:
        with open(_path(week), encoding="utf-8") as fh:
            raw = json.load(fh)
    except FileNotFoundError:
        return {}
    except (OSError, ValueError):
        return {}
    if not isinstance(raw, dict):
        return {}
    return {k: list(v) for k, v in raw.items() if isinstance(v, list)}


def counts(week=None):
    """slug -> number of votes this week."""
    week = week or week_id()
    data = _read(week)
    return {slug: len(v) for slug, v in data.items()}


def total(week=None):
    return sum(counts(week).values())


def cast(week, slug, voter):
    """Record one vote. Returns (counts, accepted)."""
    if not voter or not re.match(r"^[a-z0-9][a-z0-9-]{0,63}$", slug or ""):
        return counts(week), False
    with _lock:
        data = _read(week)
        voters = data.setdefault(slug, [])
        if voter in voters:
            return {s: len(v) for s, v in data.items()}, False
        voters.append(voter)
        os.makedirs(DIR, exist_ok=True)
        tmp = _path(week) + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
            fh.write("\n")
        os.replace(tmp, _path(week))
        return {s: len(v) for s, v in data.items()}, True


def has_voted(week, slug, voter):
    return voter in (_read(week or week_id()).get(slug) or [])
