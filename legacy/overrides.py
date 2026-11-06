#!/usr/bin/env python3
"""Operator overrides for the curated catalogue.

The admin console used to have two controls that looked real and were not: the
pin switch wrote to localStorage, and "unpublish" greyed out a table row. Both
were client-side only, so the site never changed.

This is the server-side store behind them. One small JSON file:

    data/tool-overrides.json
    {"claude": {"pin": true, "until": "2026-11-10"}, "spam-tool": {"hidden": true}}

`pin` is applied on top of whatever the data says (an operator can extend a
placement without touching mvp.json). `hidden` takes the listing out of every
list and makes its page 410 — the page file stays on disk, because a deploy
that deletes files is not something a static build does.
"""

import json
import os
import re
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
PATH = os.path.join(DATA, "tool-overrides.json")

_lock = threading.Lock()
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


def _read():
    try:
        with open(PATH, encoding="utf-8") as fh:
            raw = json.load(fh)
    except FileNotFoundError:
        return {}
    except (OSError, ValueError):
        return {}
    return raw if isinstance(raw, dict) else {}


def load():
    return _read()


def mtime():
    try:
        return os.path.getmtime(PATH)
    except OSError:
        return 0


def set_flag(slug, key, value, until=None):
    """Set one flag for one listing. Returns the whole record."""
    if not SLUG_RE.match(str(slug or "")):
        raise ValueError("bad_slug")
    if key not in ("pin", "hidden"):
        raise ValueError("bad_key")
    with _lock:
        data = _read()
        row = dict(data.get(slug) or {})
        if value:
            row[key] = True
        else:
            row.pop(key, None)
        if key == "pin" and value:
            row["until"] = until or ""
            row["pinned_at"] = int(time.time())
        if key == "pin" and not value:
            row.pop("until", None)
            row.pop("pinned_at", None)
        # An empty record is not an override — leaving `{}` behind made
        # "unpin" look like it had not worked when you read the file.
        if not row:
            data.pop(slug, None)
        else:
            data[slug] = row
        os.makedirs(DATA, exist_ok=True)
        tmp = PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2, sort_keys=True)
            fh.write("\n")
        os.replace(tmp, PATH)
        return row


def hidden(slug):
    return bool((_read().get(slug) or {}).get("hidden"))
