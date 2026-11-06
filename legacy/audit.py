#!/usr/bin/env python3
"""On-page SEO audit — real fetch, real checks, no third-party API.

Everything here runs against the raw HTML the server sends (no JS execution),
which is exactly what crawlers and most AI crawlers see.

Used by serve.py:  GET /api/audit?url=https://example.com&lang=en

20 checks, 5 groups, 20 points per group, 100 total.
"""

import ipaddress
import json
import re
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.parse import urlparse
from urllib.request import Request, urlopen

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 ProductAtlasBot/1.0")
TIMEOUT = 12
MAX_BYTES = 3 * 1024 * 1024

# Per-request language, kept in thread-local storage: the server is threaded,
# so a module-level variable would leak between concurrent requests.
_ctx = threading.local()


def bi(zh, en):
    return zh if getattr(_ctx, "lang", "en") == "zh" else en


class FetchError(Exception):
    pass


def _assert_public(host):
    """Refuse localhost / private ranges so the endpoint can't be used as SSRF."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise FetchError("domain_not_found")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise FetchError("blocked_host")


def normalize_url(raw):
    raw = (raw or "").strip()
    if not raw:
        raise FetchError("empty_url")
    if "://" in raw and not re.match(r"^https?://", raw, re.I):
        raise FetchError("invalid_url")   # ftp://, file://, javascript:
    if not re.match(r"^https?://", raw, re.I):
        if re.search(r"\s", raw) or "." not in raw.split("/")[0]:
            raise FetchError("invalid_url")
        raw = "https://" + raw
    p = urlparse(raw)
    if p.scheme not in ("http", "https") or not p.netloc or "." not in p.netloc:
        raise FetchError("invalid_url")
    return p


def fetch(url, want_bytes=False):
    p = normalize_url(url)
    _assert_public(p.hostname)
    req = Request(p.geturl(), headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
    })
    try:
        with urlopen(req, timeout=TIMEOUT) as r:
            raw = r.read(MAX_BYTES)
            return {
                "status": r.status,
                "final_url": r.geturl(),
                "headers": dict(r.headers),
                "body": raw,
            }
    except FetchError:
        raise
    except Exception as exc:  # noqa: BLE001 - network errors are all "unreachable"
        raise FetchError("unreachable: %s" % type(exc).__name__)


def _decode(raw, headers):
    ctype = headers.get("Content-Type", "") or headers.get("content-type", "")
    m = re.search(r"charset=([\w-]+)", ctype, re.I)
    enc = m.group(1) if m else "utf-8"
    try:
        return raw.decode(enc, "replace")
    except LookupError:
        return raw.decode("utf-8", "replace")


class Page(HTMLParser):
    """Collects just the signals the checks need."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self._in_title = False
        self.metas = []
        self.links = []
        self.scripts = []
        self.headings = []          # (level, text)
        self._h = None
        self._htext = []
        self.imgs = []
        self.semantic = set()
        self.text = []
        self._skip = 0
        self.lang = None
        self.jsonld_raw = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            self.metas.append(a)
        elif tag == "link":
            self.links.append(a)
        elif tag == "script":
            self.scripts.append(a)
            if "ld+json" in (a.get("type") or ""):
                self._jsonld = True
                self._buf = []
        elif tag in ("h1", "h2", "h3"):
            self._h = int(tag[1])
            self._htext = []
        elif tag == "img":
            self.imgs.append(a)
        elif tag in ("main", "article", "section", "nav", "header", "footer", "aside"):
            self.semantic.add(tag)
        elif tag in ("script", "style", "noscript"):
            self._skip += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag in ("h1", "h2", "h3") and self._h:
            self.headings.append((self._h, "".join(self._htext).strip()))
            self._h = None
        elif tag == "script":
            if getattr(self, "_jsonld", False):
                self.jsonld_raw.append("".join(self._buf))
                self._jsonld = False
            if self._skip:
                self._skip -= 1
        elif tag in ("style", "noscript") and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif getattr(self, "_jsonld", False):
            self._buf.append(data)
        elif self._h:
            self._htext.append(data)
        elif not self._skip:
            self.text.append(data)


def _meta(page, key, val="name"):
    for m in page.metas:
        if (m.get(val) or "").lower() == key.lower():
            return m.get("content") or ""
    return ""


def _check(cid, group, label, status, detail, fix=""):
    return {"id": cid, "group": group, "label": label,
            "status": status, "detail": detail, "fix": fix}


def _probe(url):
    """Secondary fetch for llms.txt / robots.txt / sitemap.xml.

    Runs in a thread pool so the three probes overlap instead of stacking
    three 12s timeouts.
    """
    try:
        r = fetch(url)
        return {"status": r["status"], "size": len(r["body"])}
    except FetchError:
        return {"status": 0, "size": 0}
    except Exception:  # noqa: BLE001
        return {"status": 0, "size": 0}


GROUPS = [
    ("meta", "标题与描述", "Title & description"),
    ("schema", "结构化数据", "Structured data"),
    ("ai", "AI 可读性", "AI readability"),
    ("crawl", "抓取与索引", "Crawl & index"),
    ("content", "内容与关键词", "Content & keywords"),
]


def audit(url, lang="en"):
    _ctx.lang = "zh" if str(lang).lower().startswith("zh") else "en"
    res = fetch(url)
    html = _decode(res["body"], res["headers"])

    final = res["final_url"]
    origin = "{0.scheme}://{0.netloc}".format(urlparse(final))
    checks = []

    # The three file probes are independent of the page checks, so start them
    # now and read the results later — they overlap with the parsing work.
    probe_targets = ("llms.txt", "robots.txt", "sitemap.xml")
    probes = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {name: pool.submit(_probe, origin + "/" + name)
                   for name in probe_targets}
        # parse the page while the probes are in flight
        page = Page()
        try:
            page.feed(html)
        except Exception:  # noqa: BLE001 - malformed HTML should not kill the audit
            pass
        for name, fut in futures.items():
            try:
                probes[name] = fut.result()
            except Exception:  # noqa: BLE001
                probes[name] = {"status": 0, "size": 0}

    # ---------- 1. title & description ----------
    title = page.title.strip()
    if not title:
        checks.append(_check("title", "meta", bi("Title 标签", "Title tag"), "fail",
                             bi("页面没有 <title>", "No <title> element"),
                             bi("加一个 15–60 字符的标题", "Add a 15-60 character title")))
    else:
        n = len(title)
        ok = 15 <= n <= 60
        checks.append(_check("title", "meta", bi("Title 标签", "Title tag"),
                             "pass" if ok else "warn",
                             bi("%d 字符：%s", "%d characters: %s") % (n, title[:70]),
                             "" if ok else bi("控制在 15–60 字符", "Keep it between 15 and 60 characters")))

    desc = _meta(page, "description")
    if not desc:
        checks.append(_check("desc", "meta", bi("Meta 描述", "Meta description"), "fail",
                             bi("缺失", "Missing"),
                             bi("写一段 50–160 字符的描述", "Write a 50-160 character description")))
    else:
        n = len(desc)
        ok = 50 <= n <= 160
        checks.append(_check("desc", "meta", bi("Meta 描述", "Meta description"),
                             "pass" if ok else "warn",
                             bi("%d 字符", "%d characters") % n,
                             "" if ok else bi("控制在 50–160 字符", "Keep it between 50 and 160 characters")))

    og_title = _meta(page, "og:title", "property")
    og_img = _meta(page, "og:image", "property")
    og_ok = bool(og_title and og_img)
    checks.append(_check("og", "meta", "Open Graph",
                         "pass" if og_ok else "warn",
                         bi("title + image 都有", "title + image present") if og_ok
                         else bi("缺 og:title 或 og:image", "og:title or og:image missing"),
                         "" if og_ok else bi("补 og:title / og:description / og:image，分享卡片才正常",
                                             "Add og:title / og:description / og:image so share cards render")))
    tw = _meta(page, "twitter:card")
    checks.append(_check("twitter", "meta", "Twitter card",
                         "pass" if tw else "warn",
                         tw or bi("缺失", "Missing"),
                         "" if tw else 'Add <meta name="twitter:card" content="summary_large_image">'))

    # ---------- 2. structured data ----------
    ld = [b for b in page.jsonld_raw if b.strip()]
    types, bad, no_ctx = [], 0, 0
    for block in ld:
        try:
            data = json.loads(block)
        except Exception:  # noqa: BLE001
            bad += 1
            continue
        if '"@context"' not in block:
            no_ctx += 1
        stack = data if isinstance(data, list) else [data]
        for node in stack:
            if isinstance(node, dict):
                t = node.get("@type")
                if isinstance(t, list):
                    types += [str(x) for x in t]
                elif t:
                    types.append(str(t))

    if not ld:
        jl_status, jl_detail = "fail", bi("没有找到 JSON-LD", "No JSON-LD found")
    elif bad:
        jl_status, jl_detail = "warn", bi("%d 段里有 %d 段解析失败", "%d of %d blocks do not parse") % (len(ld), bad)
    elif no_ctx:
        jl_status, jl_detail = "warn", bi("%d 段缺 @context", "%d block(s) missing @context") % no_ctx
    else:
        jl_status = "pass"
        jl_detail = bi("%d 段，类型：%s", "%d block(s), types: %s") % (
            len(ld), ", ".join(sorted(set(types))[:5]))
    checks.append(_check("jsonld", "schema", "JSON-LD", jl_status, jl_detail,
                         "" if jl_status == "pass" else
                         bi("加 SoftwareApplication / Product 结构化数据，@context 用 https://schema.org",
                            "Add SoftwareApplication / Product JSON-LD with @context https://schema.org")))

    good_types = ("Product", "SoftwareApplication", "WebApplication", "Organization", "Article")
    type_ok = any(t in good_types for t in types)
    checks.append(_check("schema_type", "schema", bi("Schema 类型匹配", "Schema type match"),
                         "pass" if type_ok else "warn",
                         ", ".join(sorted(set(types))[:5]) or bi("无", "none"),
                         "" if type_ok else
                         bi("用 Product 或 SoftwareApplication 描述你的产品",
                            "Describe the product as Product or SoftwareApplication")))

    # ---------- 3. AI readability ----------
    h1s = [t for lv, t in page.headings if lv == 1]
    h1_ok = len(h1s) == 1
    checks.append(_check("h1", "ai", bi("唯一 H1", "Single H1"),
                         "pass" if h1_ok else ("warn" if h1s else "fail"),
                         bi("%d 个 H1", "%d H1") % len(h1s),
                         "" if h1_ok else bi("每页只保留一个 H1，写清页面主题",
                                             "Keep exactly one H1 that names the page topic")))

    semantic_ok = len(page.semantic & {"main", "article"}) > 0
    checks.append(_check("semantic", "ai", bi("语义化结构", "Semantic structure"),
                         "pass" if semantic_ok else "warn",
                         (bi("含 ", "has ") + ", ".join(sorted(page.semantic)))
                         if page.semantic else bi("全是 div", "divs only"),
                         "" if semantic_ok else
                         bi("用 <main> / <article> 包内容，AI 更好切块",
                            "Wrap content in <main> / <article> so AI can chunk it")))

    plain = re.sub(r"\s+", " ", " ".join(page.text)).strip()
    words = len(plain.split())
    checks.append(_check("text", "ai", bi("正文可提取", "Extractable text"),
                         "pass" if words >= 200 else "warn",
                         bi("约 %d 词", "about %d words") % words,
                         "" if words >= 200 else
                         bi("正文太短，AI 没有可引用的内容",
                            "Too little text for AI search to quote")))

    llms_ok = probes["llms.txt"]["status"] == 200 and probes["llms.txt"]["size"] > 20
    checks.append(_check("llms", "ai", "llms.txt",
                         "pass" if llms_ok else "warn",
                         bi("存在", "present") if llms_ok else bi("未找到 /llms.txt", "no /llms.txt"),
                         "" if llms_ok else
                         bi("放一个 llms.txt，告诉 AI 你的站点结构",
                            "Add an llms.txt that describes your site to AI crawlers")))

    # ---------- 4. crawl & index ----------
    robots_meta = _meta(page, "robots")
    noindex = "noindex" in robots_meta.lower()
    checks.append(_check("noindex", "crawl", bi("可被索引", "Indexable"),
                         "fail" if noindex else "pass",
                         "noindex" if noindex else bi("没有 noindex", "no noindex"),
                         bi("删掉 noindex", "Remove the noindex directive") if noindex else ""))

    canon = ""
    for l in page.links:
        if (l.get("rel") or "").lower() == "canonical":
            canon = l.get("href") or ""
    checks.append(_check("canonical", "crawl", "Canonical",
                         "pass" if canon else "warn",
                         canon or bi("缺失", "Missing"),
                         "" if canon else 'Add <link rel="canonical">'))

    robots_txt = probes["robots.txt"]["status"] == 200
    sitemap_ok = probes["sitemap.xml"]["status"] == 200
    checks.append(_check("robots", "crawl", "robots.txt",
                         "pass" if robots_txt else "warn",
                         bi("存在", "present") if robots_txt else bi("未找到", "not found"),
                         "" if robots_txt else
                         bi("加 robots.txt 并指向 sitemap", "Add robots.txt pointing at your sitemap")))
    checks.append(_check("sitemap", "crawl", "sitemap.xml",
                         "pass" if sitemap_ok else "warn",
                         bi("存在", "present") if sitemap_ok else bi("未找到", "not found"),
                         "" if sitemap_ok else bi("生成 sitemap.xml", "Generate a sitemap.xml")))

    https_ok = urlparse(final).scheme == "https"
    checks.append(_check("https", "crawl", "HTTPS",
                         "pass" if https_ok else "fail",
                         urlparse(final).scheme.upper(),
                         "" if https_ok else bi("全站走 HTTPS", "Serve the whole site over HTTPS")))

    checks.append(_check("lang", "crawl", bi("lang 属性", "lang attribute"),
                         "pass" if page.lang else "warn",
                         page.lang or bi("缺失", "Missing"),
                         "" if page.lang else 'Add <html lang="en">'))

    # ---------- 5. content ----------
    wc_status = "pass" if words >= 300 else ("warn" if words >= 120 else "fail")
    checks.append(_check("wordcount", "content", bi("正文长度", "Word count"), wc_status,
                         bi("%d 词", "%d words") % words,
                         "" if wc_status == "pass" else
                         bi("正文至少 300 词，才有排名竞争力",
                            "Aim for 300+ words of real content to compete")))

    h2s = [t for lv, t in page.headings if lv == 2]
    checks.append(_check("h2", "content", bi("H2 小节", "H2 sections"),
                         "pass" if len(h2s) >= 2 else "warn",
                         bi("%d 个", "%d") % len(h2s),
                         "" if len(h2s) >= 2 else
                         bi("用 H2 把内容切成 2–5 个小节", "Split the content into 2-5 H2 sections")))

    imgs = page.imgs
    with_alt = [i for i in imgs if (i.get("alt") or "").strip()]
    ratio = (len(with_alt) / len(imgs) * 100) if imgs else 100
    alt_status = "pass" if ratio >= 80 else ("warn" if ratio >= 40 else "fail")
    checks.append(_check("alt", "content", bi("图片 alt 覆盖", "Image alt coverage"), alt_status,
                         "%d/%d" % (len(with_alt), len(imgs)),
                         "" if alt_status == "pass" else
                         bi("给每张图写 alt", "Give every image alt text")))

    internal = 0
    host = urlparse(final).netloc
    for l in page.links:
        href = l.get("href") or ""
        if href.startswith("/") or (href.startswith("http") and host in href):
            internal += 1
    checks.append(_check("internal", "content", bi("内链数量", "Internal links"),
                         "pass" if internal >= 5 else "warn",
                         bi("%d 条", "%d") % internal,
                         "" if internal >= 5 else
                         bi("正文里加 5 条以上内链", "Add 5+ internal links in the body")))

    # ---------- score ----------
    weight = {"pass": 1.0, "warn": 0.5, "fail": 0.0}
    groups = []
    total = 0
    for key, zh, en in GROUPS:
        items = [c for c in checks if c["group"] == key]
        got = sum(weight[c["status"]] for c in items)
        score = round(got / len(items) * 20) if items else 0
        groups.append({"key": key, "label_zh": zh, "label_en": en,
                       "score": score, "max": 20, "count": len(items)})
        total += score

    fails = [c for c in checks if c["status"] == "fail"]
    warns = [c for c in checks if c["status"] == "warn"]
    grade = ("A" if total >= 90 else "B" if total >= 75 else
             "C" if total >= 60 else "D" if total >= 40 else "E")

    return {
        "ok": True,
        "url": url,
        "final_url": final,
        "status": res["status"],
        "score": total,
        "grade": grade,
        "groups": groups,
        "checks": checks,
        "summary": {"pass": len(checks) - len(fails) - len(warns),
                    "warn": len(warns), "fail": len(fails)},
        "title": title[:120],
        # Raw measurements, kept separate from the human labels: the report
        # store uses these to decide whether a page is worth indexing.
        "facts": {
            "words": words,
            "title": title[:160],
            "title_len": len(title),
            "desc_len": len(desc),
            "status": res["status"],
            "final_url": final,
            "host": host,
            "scheme": urlparse(final).scheme,
            "h1_count": len(h1s),
            "h2_count": len(h2s),
            "jsonld_blocks": len(ld),
            "checked_at": int(time.time()),
        },
    }
