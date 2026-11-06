#!/usr/bin/env python3
"""Render product pages for submissions that went live after the last build.

`build.py` bakes 30 curated products into static HTML. A submission approved at
2am has no static file, so "live immediately" would be a lie unless something
can render it on demand. This module reuses the *same* template as the build —
`build.build_tool()` — so a community listing is byte-for-byte the same page
shape as a curated one. No second template to drift out of sync.

build.py keeps its language and path state in module globals, so every render
holds a lock. That serialises rendering (a few ms per page) and prevents two
concurrent requests from rendering one page with the other's language.
"""

import threading

import build as B

_RENDER_LOCK = threading.Lock()

# Fields the build templates read unconditionally. A community record that is
# missing one of them used to raise inside the renderer, which surfaced as a
# 404 on a listing we had just promised a customer — the worst possible failure
# mode, because it looks like the submission was never approved. Fill the gaps
# here rather than trusting every producer to keep up with the templates.
_DEFAULTS = {
    "pin": False,
    "is_paid": False,
    "is_featured": False,
    "tags": [],
    "shots": [],
    "votes_total": 0,
    "votes_week": 0,
    "maker": "",
    "logo_remote": "",
    "featured_until": None,
}


def _norm(tool):
    out = dict(tool)
    for key, val in _DEFAULTS.items():
        if out.get(key) is None:
            out[key] = val
    return out


def _set_ctx(lang, path):
    B.LANG = "zh" if str(lang).lower().startswith("zh") else "en"
    B.at(path)


def render(tool, lang="en"):
    """Full product page HTML for one community tool."""
    tool = _norm(tool)
    slug = tool["slug"]
    with _RENDER_LOCK:
        _set_ctx(lang, f"tools/{slug}.html")
        B.TOOLS[slug] = tool
        B.TOOL_LIST.append(tool)
        try:
            return B.build_tool(slug)
        finally:
            try:
                B.TOOL_LIST.remove(tool)
            except ValueError:
                pass
            B.TOOLS.pop(slug, None)


def cards(tools, lang="en", path="just-added.html"):
    """Just the cards, rendered in the page context they will be inserted into
    (relative links depend on it)."""
    if not tools:
        return ""
    with _RENDER_LOCK:
        _set_ctx(lang, path)
        return "".join(B.tool_card(_norm(t), i) for i, t in enumerate(tools))


def feed(tools, lang="en", path="just-added.html"):
    """Rows for the "Just added" list — same renderer the build uses."""
    if not tools:
        return ""
    with _RENDER_LOCK:
        _set_ctx(lang, path)
        return "".join(B.feed_row(_norm(t)) for t in tools)
