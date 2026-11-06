#!/usr/bin/env python3
"""Domain rating lookup — real numbers only, never estimated.

The site must never print a DR value it did not receive from a provider.
So this module has three states:

  1. provider configured + answered  -> {ok: true, value, provider, metric}
  2. provider configured + failed    -> {ok: false, reason: "provider_error"}
  3. no provider configured          -> {ok: false, reason: "not_configured"}

Supported providers (set one env var):
  AHREFS_TOKEN        Ahrefs API v3   -> metric "DR"  (0-100, the number everyone means)
  OPENPAGERANK_KEY    Open PageRank  -> metric "PR"  (0-10, free, different metric)

Never present Open PageRank as DR: it is a different score. The UI reads
`metric` and labels accordingly.
"""

import json
import os
import time
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(ROOT, "data", "dr-cache.json")
TTL = 60 * 60 * 24  # 24h


def _load_cache():
    try:
        with open(CACHE_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001
        return {}


def _save_cache(cache):
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as fh:
            json.dump(cache, fh, ensure_ascii=False)
    except Exception:  # noqa: BLE001 - cache is best-effort
        pass


def _get_json(url, headers):
    req = Request(url, headers=headers)
    with urlopen(req, timeout=12) as r:
        return json.loads(r.read(200_000).decode("utf-8", "replace"))


def _ahrefs(domain):
    token = os.environ.get("AHREFS_TOKEN")
    if not token:
        return None
    data = _get_json(
        "https://api.ahrefs.com/v3/site-explorer/domain-rating?target=" + quote(domain),
        {"Authorization": "Bearer " + token, "Accept": "application/json"},
    )
    node = data.get("domain_rating") or {}
    value = node.get("domain_rating")
    if value is None:
        return None
    return {"provider": "ahrefs", "metric": "DR", "value": round(float(value)),
            "rank": node.get("ahrefs_rank")}


def _openpagerank(domain):
    key = os.environ.get("OPENPAGERANK_KEY")
    if not key:
        return None
    data = _get_json(
        "https://openpagerank.com/api/v1.0/getPageRank?domains%5B%5D=" + quote(domain),
        {"API-OPR": key, "Accept": "application/json"},
    )
    rows = data.get("response") or []
    if not rows or rows[0].get("status_code") != 200:
        return None
    row = rows[0]
    return {"provider": "openpagerank", "metric": "PR",
            "value": round(float(row.get("page_rank_decimal") or 0), 1),
            "rank": row.get("rank")}


PROVIDERS = (("ahrefs", _ahrefs), ("openpagerank", _openpagerank))


def configured():
    return [name for name, _ in PROVIDERS
            if os.environ.get({"ahrefs": "AHREFS_TOKEN",
                               "openpagerank": "OPENPAGERANK_KEY"}[name])]


def lookup(domain, force=False):
    domain = (domain or "").strip().lower()
    for pre in ("https://", "http://"):
        if domain.startswith(pre):
            domain = domain[len(pre):]
    domain = domain.split("/")[0].split("?")[0]
    if not domain or "." not in domain:
        return {"ok": False, "reason": "invalid_domain"}

    cache = _load_cache()
    hit = cache.get(domain)
    if hit and not force and time.time() - hit.get("ts", 0) < TTL:
        out = dict(hit["data"])
        out["cached"] = True
        return out

    if not configured():
        return {"ok": False, "reason": "not_configured",
                "providers": [n for n, _ in PROVIDERS]}

    last_err = None
    for name, fn in PROVIDERS:
        try:
            got = fn(domain)
        except Exception as exc:  # noqa: BLE001
            last_err = "%s: %s" % (name, type(exc).__name__)
            continue
        if got:
            out = {"ok": True, "domain": domain, "checked_at": int(time.time()),
                   "cached": False, **got}
            cache[domain] = {"ts": time.time(), "data": out}
            _save_cache(cache)
            return out

    return {"ok": False, "reason": "provider_error", "detail": last_err}
