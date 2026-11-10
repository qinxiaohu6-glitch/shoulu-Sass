/**
 * On-page SEO audit — the checks from `legacy/audit.py`, ported to run on
 * Cloudflare Workers and then deepened against the claude-seo rubric.
 *
 * The port is not a rewrite of the scoring. The thresholds, the five groups,
 * the pass=1 / warn=0.5 / fail=0 weights and the A–E cut-offs are copied
 * verbatim, because a score that changes meaning between builds is worse than
 * no score: people screenshot these numbers.
 *
 * Rubric 2 added eight checks, all of them measurable from what a single
 * fetch already returns — no extra outbound request, no invented data:
 *
 *   ai_crawlers       robots.txt actually read, not just its status code
 *   qa_headings       headings phrased the way people search
 *   authority         Organization / Person with a URL (the machine-readable
 *                     sliver of E-E-A-T)
 *   schema_required   declared types carrying their required properties
 *   schema_deprecated types Google retired (HowTo, ClaimReview, …)
 *   hreflang          declared-but-broken is worse than never declared
 *   img_dims          width/height, the most common cause of CLS
 *   list_table        structure an AI answer can lift whole
 *
 * Core Web Vitals are deliberately absent. LCP / INP / CLS are field metrics
 * from CrUX; there is no honest way to infer them from HTML, and a fabricated
 * number is the one thing this tool must never print.
 *
 * Three things could not come across as they were:
 *
 *  1. `socket.getaddrinfo` does not exist on Workers, so the SSRF guard is a
 *     literal check (private ranges, `localhost`, `*.internal`) instead of a
 *     resolved-address check. That is the belt, not the braces — Workers
 *     cannot reach private address space at all, so the guard only has to
 *     stop the request being *made*, not police the route.
 *  2. `HTMLParser` has no counterpart. `HTMLRewriter` is Workers-only and
 *     unavailable under `nuxt dev` on Node, so this ships a small scanner.
 *     It reads tags, raw-text elements (`script`, `style`, `noscript`,
 *     `template`, `textarea`) and the inner text of headings and `title`.
 *     That is the whole surface the checks touch.
 *  3. `urlopen` raises on 4xx/5xx. Here a non-2xx is reported as `http_error`
 *     rather than being folded into `unreachable` — "your page 404s" and
 *     "your page timed out" are different problems with different fixes.
 *  4. `fetch("https://dirtool.com/…")` from this Worker does not hit this
 *     Worker. On a custom domain Cloudflare forwards a same-zone subrequest
 *     to the zone origin, and there is no origin — the Worker is the site —
 *     so the edge returns 522. Own-host reads go through Nitro `localFetch`
 *     (the call the Worker already uses to serve the page). Every other host
 *     still uses `globalThis.fetch`, unchanged.
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36 ProductAtlasBot/1.0'

const TIMEOUT_MS = 12_000
const PROBE_TIMEOUT_MS = 8_000
const MAX_BYTES = 3 * 1024 * 1024
/** Enough to decide "does /llms.txt exist and have content", not to read it. */
const PROBE_BYTES = 64 * 1024

export type AuditLang = 'zh' | 'en'
export type CheckStatus = 'pass' | 'warn' | 'fail'

type ErrorCopy = { status: number; zh: string; en: string }

/**
 * Error vocabulary for this endpoint.
 *
 * Deliberately separate from `SUBMIT_ERRORS`: those messages are written for a
 * form ("check the URL field") and this one is written for a stranger pasting
 * a link. Sharing the table would have made one of the two read wrong.
 */
export const AUDIT_ERRORS: Record<string, ErrorCopy> = {
  empty_url: {
    status: 400,
    zh: '请输入要检测的网址。',
    en: 'Enter a URL to check.',
  },
  invalid_url: {
    status: 400,
    zh: '这个网址看起来不对，试试 https://your-site.com',
    en: 'That does not look like a URL. Try https://your-site.com',
  },
  blocked_host: {
    status: 403,
    zh: '这个地址不允许检测（内网 / 本机地址）。',
    en: 'That host is not allowed (private or local address).',
  },
  http_error: {
    status: 502,
    zh: '这个页面返回了错误状态码，没有可检测的内容。',
    en: 'That page returned an error status, so there is nothing to check.',
  },
  unreachable: {
    status: 502,
    zh: '抓不到这个页面，可能超时或被拦截了。',
    en: 'Could not reach that page. It may be slow or blocking bots.',
  },
  rate_limited: {
    status: 429,
    zh: '请求太频繁了，一分钟后再试。',
    en: 'Too many checks — try again in a minute.',
  },
  internal_error: {
    status: 500,
    zh: '诊断过程出错了，请重试。',
    en: 'The check hit an internal error. Try again.',
  },
}

export class AuditError extends Error {
  /** Machine code (`http_error`, `unreachable`, …). */
  code: keyof typeof AUDIT_ERRORS | string
  /** HTTP status the *target* returned, when the failure was the target's. */
  upstream?: number

  constructor(code: keyof typeof AUDIT_ERRORS | string, upstream?: number) {
    super(code)
    this.code = code
    this.upstream = upstream
  }
}

// ---------------------------------------------------------------------------
// URL handling + SSRF guard
// ---------------------------------------------------------------------------

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localdomain|.*\.localhost)$/i
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/**
 * Refuse the hosts an audit endpoint must never fetch.
 *
 * This runs on the literal host only. On Workers there is no resolver to ask,
 * and there does not need to be: the runtime's egress path cannot reach
 * private address space, so a name that resolves to `10.0.0.5` fails at
 * connect time. The check here stops the obvious cases from even leaving.
 */
export function isPrivateHost(host: string): boolean {
  if (!host) return true
  if (PRIVATE_HOST.test(host)) return true

  const v4 = host.match(IPV4)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // carrier-grade NAT
    if (a >= 224) return true // multicast / reserved
    return false
  }

  // `new URL()` hands IPv6 literals over still bracketed.
  const bare = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (bare === '::1' || bare === '::') return true
  if (bare.startsWith('fe80:') || bare.startsWith('fc') || bare.startsWith('fd')) return true
  return false
}

/**
 * `example.com` → `https://example.com`; `ftp://…` → rejected.
 *
 * Same order of checks as the Python original, including the odd-looking one
 * that rejects a bare host without a dot — that is what keeps `localhost:3000`
 * out at the parsing step instead of the fetch step.
 */
export function normalizeUrl(raw: string): URL {
  let s = (raw || '').trim()
  if (!s) throw new AuditError('empty_url')

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s)) {
    throw new AuditError('invalid_url')
  }
  if (!/^https?:\/\//i.test(s)) {
    if (/\s/.test(s) || !s.split('/')[0]!.includes('.')) throw new AuditError('invalid_url')
    s = 'https://' + s
  }

  let url: URL
  try {
    url = new URL(s)
  } catch {
    throw new AuditError('invalid_url')
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) {
    throw new AuditError('invalid_url')
  }
  return url
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

function charsetOf(res: Response): string {
  const ctype = res.headers.get('content-type') || ''
  return /charset=([\w-]+)/i.exec(ctype)?.[1] ?? 'utf-8'
}

/** Read at most `cap` bytes as text, then hang up. */
async function readCapped(res: Response, cap: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''

  let decoder: TextDecoder
  try {
    decoder = new TextDecoder(charsetOf(res))
  } catch {
    // An unknown label must not fail the audit; utf-8 with replacement is
    // what the Python version fell back to as well.
    decoder = new TextDecoder('utf-8')
  }

  let out = ''
  let size = 0
  try {
    while (size < cap) {
      const { done, value } = await reader.read()
      if (done || !value) break
      size += value.byteLength
      out += decoder.decode(value, { stream: true })
    }
    out += decoder.decode()
  } finally {
    void reader.cancel().catch(() => {})
  }
  return out
}

type FetchedPage = {
  status: number
  finalUrl: string
  html: string
}

/**
 * In-process GET of a path on this Worker.
 *
 * Nitro's Cloudflare handler serves the site by calling `localFetch` with a
 * path (`/zh`), not with an absolute URL. An absolute URL falls through to
 * `globalThis.fetch` and is the 522 above. `host` / `protocol` are the
 * node-mock-http fields that localFetch forwards onto the synthetic request.
 */
export type OwnSiteFetch = (
  path: string,
  init?: RequestInit & { host?: string; protocol?: string },
) => Promise<Response>

export type AuditOptions = {
  /**
   * Host that invoked `/api/audit`. A self-check of that host (a preview
   * subdomain, or `*.workers.dev`) is also in-process. It is never taken from
   * the submitted URL alone, so a caller cannot point this at some other site.
   */
  requestHost?: string
  /** Production wires Nitro's `localFetch`. Tests pass a fake. */
  localFetch?: OwnSiteFetch
  /** Test seam. Unset means `globalThis.fetch` — the external-site path. */
  publicFetch?: typeof fetch
}

const OWN_APEX = 'dirtool.com'
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])
const MAX_OWN_HOPS = 5

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '')
}

/** A host this Worker actually serves, so a public fetch of it would 522. */
function isThisWorkerHost(host: string): boolean {
  return host === OWN_APEX || host.endsWith(`.${OWN_APEX}`) || host.endsWith('.workers.dev')
}

/**
 * `dirtool.com` and `www.dirtool.com` always. Any other hostname only when
 * it is the host this request arrived on, and that host belongs to this Worker.
 */
export function isOwnAuditHost(hostname: string, requestHost = ''): boolean {
  const host = normalizeHost(hostname)
  if (host === OWN_APEX || host === `www.${OWN_APEX}`) return true
  const req = normalizeHost(requestHost)
  return Boolean(req && host === req && isThisWorkerHost(host))
}

type SendInit = { signal?: AbortSignal; headers: HeadersInit }

function publicFetchOf(options?: AuditOptions): typeof fetch {
  return options?.publicFetch ?? globalThis.fetch
}

/**
 * `localFetch` does not honour `AbortSignal` (it is an in-process call). Race
 * it so the same 12s / 8s cap that bounds a public fetch bounds a self-check.
 */
function withSignal(promise: Promise<Response>, signal?: AbortSignal): Promise<Response> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (err) => {
        signal.removeEventListener('abort', onAbort)
        reject(err)
      },
    )
  })
}

/** Follow in-process redirects (www → apex, http → https) without leaving the Worker. */
async function sendOwn(
  start: URL,
  init: SendInit,
  options: AuditOptions,
): Promise<{ res: Response; finalUrl: string }> {
  const localFetch = options.localFetch!
  let current = start

  for (let hop = 0; hop < MAX_OWN_HOPS; hop++) {
    const headers = new Headers(init.headers)
    const proto = current.protocol === 'http:' ? 'http' : 'https'
    headers.set('host', current.hostname)
    headers.set('x-forwarded-proto', proto)

    const res = await withSignal(
      localFetch(current.pathname + current.search, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: init.signal,
        host: current.hostname,
        protocol: proto,
      }),
      init.signal,
    )

    if (!REDIRECT_STATUS.has(res.status)) return { res, finalUrl: current.toString() }

    const loc = res.headers.get('location')
    void res.body?.cancel().catch(() => {})
    if (!loc) return { res, finalUrl: current.toString() }

    const next = new URL(loc, current)
    if (!['http:', 'https:'].includes(next.protocol) || isPrivateHost(next.hostname)) {
      throw new AuditError('blocked_host')
    }
    // A redirect that leaves the zone (it does not, today) must not be served
    // from this Worker's renderer. Finish it on the public path.
    if (!isOwnAuditHost(next.hostname, options.requestHost) || !options.localFetch) {
      const followed = await publicFetchOf(options)(next.toString(), {
        signal: init.signal,
        redirect: 'follow',
        headers: init.headers,
      })
      return { res: followed, finalUrl: followed.url || next.toString() }
    }
    current = next
  }

  throw new AuditError('unreachable')
}

async function send(
  target: URL,
  init: SendInit,
  options?: AuditOptions,
): Promise<{ res: Response; finalUrl: string }> {
  if (options?.localFetch && isOwnAuditHost(target.hostname, options.requestHost)) {
    return sendOwn(target, init, options)
  }

  const res = await publicFetchOf(options)(target.toString(), {
    signal: init.signal,
    redirect: 'follow',
    headers: init.headers,
  })
  return { res, finalUrl: res.url || target.toString() }
}

async function fetchPage(target: URL, options?: AuditOptions): Promise<FetchedPage> {
  if (isPrivateHost(target.hostname)) throw new AuditError('blocked_host')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const { res, finalUrl } = await send(
      target,
      {
        signal: controller.signal,
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        },
      },
      options,
    )

    // A redirect can land somewhere the guard would have refused. `finalUrl`
    // is the URL actually served, not the one we asked for.
    let finalHost = ''
    try {
      finalHost = new URL(finalUrl).hostname
    } catch {
      finalHost = target.hostname
    }
    if (isPrivateHost(finalHost)) {
      void res.body?.cancel().catch(() => {})
      throw new AuditError('blocked_host')
    }

    if (!res.ok) {
      void res.body?.cancel().catch(() => {})
      throw new AuditError('http_error', res.status)
    }

    return { status: res.status, finalUrl, html: await readCapped(res, MAX_BYTES) }
  } catch (err) {
    if (err instanceof AuditError) throw err
    // AbortError, DNS failure, TLS refusal, a body that never finishes — all
    // the same thing to the person who pasted the link.
    throw new AuditError('unreachable')
  } finally {
    clearTimeout(timer)
  }
}

type Probe = { status: number; size: number; text: string }

/**
 * Secondary fetch for `llms.txt` / `robots.txt` / `sitemap.xml`.
 *
 * `robots.txt` keeps its body because the AI-crawler check has to read the
 * rules, not just the status code — a 200 that says `Disallow: /` for
 * `OAI-SearchBot` is the single most common way a site quietly removes itself
 * from ChatGPT Search while believing it did nothing.
 */
async function probe(url: string, wantText = false, options?: AuditOptions): Promise<Probe> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    const { res } = await send(
      new URL(url),
      {
        signal: controller.signal,
        headers: { 'user-agent': UA, accept: 'text/plain,application/xml,text/xml,*/*' },
      },
      options,
    )

    const reader = res.body?.getReader()
    let size = 0
    let text = ''
    if (reader) {
      const decoder = new TextDecoder('utf-8')
      while (size < PROBE_BYTES) {
        const { done, value } = await reader.read()
        if (done || !value) break
        size += value.byteLength
        if (wantText) text += decoder.decode(value, { stream: true })
      }
      if (wantText) text += decoder.decode()
      void reader.cancel().catch(() => {})
    }
    return { status: res.status, size, text }
  } catch {
    return { status: 0, size: 0, text: '' }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// robots.txt — who is allowed in
// ---------------------------------------------------------------------------

/**
 * The crawlers that decide whether an AI search product can cite you.
 *
 * These are **search** crawlers, not training crawlers, and the distinction is
 * the whole point of this check:
 *
 *   OAI-SearchBot      → ChatGPT Search can cite the page
 *   Claude-SearchBot   → Claude's search features can cite the page
 *   PerplexityBot      → Perplexity's index
 *
 * `GPTBot`, `ClaudeBot`, `CCBot` and `Applebot-Extended` are training-only
 * signals. Blocking them costs nothing in search visibility, and telling a
 * site owner otherwise is the most common piece of AI-SEO misinformation
 * going. `Google-Extended` likewise governs Gemini training, **not** Google
 * Search or AI Overviews — those come from the Googlebot index.
 */
const AI_SEARCH_BOTS = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'] as const

/**
 * Parse robots.txt into `agent → disallow paths`.
 *
 * Only Disallow is kept: the question this answers is "is this crawler shut
 * out entirely", which is `Disallow: /`. A group with an empty `Disallow:`
 * is recorded as an empty list, because that is how a site says "this bot is
 * explicitly welcome" — and it must override the `*` group rather than fall
 * through to it.
 */
function robotsRules(text: string): Map<string, string[]> {
  const rules = new Map<string, string[]>()
  let agents: string[] = []
  let collectingAgents = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue

    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()

    if (key === 'user-agent') {
      // A User-agent line after rules starts a new group; consecutive ones
      // share the rules that follow.
      if (!collectingAgents) {
        agents = []
        collectingAgents = true
      }
      agents.push(value.toLowerCase())
      continue
    }

    collectingAgents = false
    if (key !== 'disallow') continue

    for (const agent of agents) {
      const list = rules.get(agent) ?? []
      if (value) list.push(value)
      rules.set(agent, list)
    }
  }
  return rules
}

function blocksEverything(rules: Map<string, string[]>, bot: string): boolean {
  // An explicit group for the bot wins over `*`, including an empty one.
  const list = rules.has(bot.toLowerCase()) ? rules.get(bot.toLowerCase())! : rules.get('*')
  if (!list || !list.length) return false
  return list.some((path) => path === '/' || path === '/*')
}

// ---------------------------------------------------------------------------
// Schema requirements
// ---------------------------------------------------------------------------

/**
 * Required properties per type, from the skill's `schema-types.md`.
 *
 * Trimmed to what a single page can be judged on: `Product` without `offers`
 * or `Article` without `author` / `datePublished` is markup that validates as
 * JSON but produces no rich result.
 */
const SCHEMA_REQUIRED: Record<string, string[]> = {
  Product: ['name', 'image', 'offers'],
  SoftwareApplication: ['name', 'offers'],
  WebApplication: ['name'],
  Article: ['headline', 'author', 'datePublished'],
  BlogPosting: ['headline', 'author', 'datePublished'],
  NewsArticle: ['headline', 'author', 'datePublished'],
  Organization: ['name', 'url'],
  LocalBusiness: ['name', 'address'],
  WebSite: ['name', 'url'],
  WebPage: ['name'],
  Person: ['name'],
  Event: ['name', 'startDate', 'location'],
  JobPosting: ['title', 'datePosted', 'hiringOrganization'],
  VideoObject: ['name', 'thumbnailUrl', 'uploadDate'],
  BreadcrumbList: ['itemListElement'],
}

/**
 * Types Google has retired. Keeping them costs nothing but produces nothing:
 * no rich result, and no validator in Search Console to check them against
 * since 2025-09-09.
 *
 * `Dataset` is deliberately absent — it is not deprecated, it is simply only
 * consumed by Dataset Search. Telling someone to delete working Dataset markup
 * would be a regression.
 */
const SCHEMA_DEPRECATED = new Set([
  'HowTo',
  'SpecialAnnouncement',
  'CourseInfo',
  'EstimatedSalary',
  'LearningVideo',
  'ClaimReview',
  'VehicleListing',
  'PracticeProblem',
])

// ---------------------------------------------------------------------------
// HTML scanning
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '\u2019',
  lsquo: '\u2018',
  ldquo: '\u201c',
  rdquo: '\u201d',
}

function decodeEntities(s: string): string {
  if (!s.includes('&')) return s
  return s.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = hex ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole
  })
}

const ATTR_RE = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  ATTR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR_RE.exec(raw))) {
    const name = m[1]!.toLowerCase()
    // Duplicate attributes: the first one wins, as in HTMLParser.
    if (name in out) continue
    out[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return out
}

/** Index of the `>` that closes the tag starting at `from`, quote-aware. */
function findTagEnd(html: string, from: number): number {
  let quote = ''
  for (let i = from; i < html.length; i++) {
    const ch = html[i]!
    if (quote) {
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '>') return i
  }
  return -1
}

/** First `</tag>` at or after `from`, case-insensitive, without copying the body. */
function findCloseTag(html: string, from: number, tag: string): number {
  const re = new RegExp(`</${tag}\\s*>`, 'ig')
  re.lastIndex = from
  const m = re.exec(html)
  return m ? m.index : -1
}

const RAW_TEXT = new Set(['script', 'style', 'noscript', 'textarea', 'template'])
const SEMANTIC = new Set(['main', 'article', 'section', 'nav', 'header', 'footer', 'aside'])

export type ParsedPage = {
  title: string
  metas: Record<string, string>[]
  /** `<link>` elements — canonical, hreflang, icons. NOT body links. */
  links: Record<string, string>[]
  /** `<a href>` elements — the only thing an "internal links" count may use. */
  anchors: Record<string, string>[]
  headings: { level: number; text: string }[]
  imgs: Record<string, string>[]
  semantic: Set<string>
  /** `ul` / `ol` / `table` — the structure AI answers can actually lift. */
  structured: Set<string>
  text: string[]
  lang: string | null
  jsonld: string[]
}

/**
 * Walk the document once, collecting only what the checks read.
 *
 * Headings and `title` are captured by slicing to their closing tag rather
 * than by tracking state: neither can nest, so a state machine would be more
 * code for the same answer.
 */
export function parseHtml(html: string): ParsedPage {
  const page: ParsedPage = {
    title: '',
    metas: [],
    links: [],
    anchors: [],
    headings: [],
    imgs: [],
    semantic: new Set(),
    structured: new Set(),
    text: [],
    lang: null,
    jsonld: [],
  }

  const n = html.length
  let i = 0

  const pushText = (s: string) => {
    if (!s) return
    const decoded = decodeEntities(s)
    if (decoded.trim()) page.text.push(decoded)
  }

  while (i < n) {
    const lt = html.indexOf('<', i)
    if (lt < 0) {
      pushText(html.slice(i))
      break
    }
    if (lt > i) pushText(html.slice(i, lt))

    // Comments and doctype / processing instructions: no data, no tags.
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      i = end < 0 ? n : end + 3
      continue
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt)
      i = end < 0 ? n : end + 1
      continue
    }

    const gt = findTagEnd(html, lt + 1)
    if (gt < 0) {
      pushText(html.slice(lt))
      break
    }

    let raw = html.slice(lt + 1, gt)
    const closing = raw.startsWith('/')
    if (closing) raw = raw.slice(1)
    if (raw.endsWith('/')) raw = raw.slice(0, -1)

    const nameMatch = /^([a-zA-Z][\w:-]*)/.exec(raw)
    if (!nameMatch) {
      i = gt + 1
      continue
    }

    const tag = nameMatch[1]!.toLowerCase()
    const attrs = parseAttrs(raw.slice(nameMatch[0].length))
    i = gt + 1

    if (closing) continue

    if (tag === 'html') {
      page.lang = attrs.lang ?? null
      continue
    }
    if (tag === 'meta') {
      page.metas.push(attrs)
      continue
    }
    if (tag === 'link') {
      page.links.push(attrs)
      continue
    }
    if (tag === 'a') {
      page.anchors.push(attrs)
      continue
    }
    if (tag === 'img') {
      page.imgs.push(attrs)
      continue
    }
    if (SEMANTIC.has(tag)) page.semantic.add(tag)
    if (tag === 'ul' || tag === 'ol' || tag === 'table') page.structured.add(tag)

    if (tag === 'title') {
      const close = findCloseTag(html, i, 'title')
      if (close < 0) break
      page.title = decodeEntities(html.slice(i, close))
      const end = html.indexOf('>', close)
      i = end < 0 ? n : end + 1
      continue
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const close = findCloseTag(html, i, tag)
      if (close < 0) break
      // Nested inline markup is stripped rather than concatenated: the checks
      // only care whether there is a heading and roughly what it says.
      const inner = decodeEntities(html.slice(i, close).replace(/<[^>]*>/g, ' '))
      page.headings.push({ level: Number(tag[1]), text: inner.replace(/\s+/g, ' ').trim() })
      const end = html.indexOf('>', close)
      i = end < 0 ? n : end + 1
      continue
    }

    if (RAW_TEXT.has(tag)) {
      const close = findCloseTag(html, i, tag)
      if (close < 0) {
        i = n
        break
      }
      if (tag === 'script' && /ld\+json/i.test(attrs.type || '')) {
        page.jsonld.push(html.slice(i, close))
      }
      const end = html.indexOf('>', close)
      i = end < 0 ? n : end + 1
      continue
    }
  }

  return page
}

/** First `<meta name|property="key">` content, or ''. */
function metaOf(page: ParsedPage, key: string, val: 'name' | 'property' = 'name'): string {
  const wanted = key.toLowerCase()
  for (const m of page.metas) {
    if ((m[val] || '').toLowerCase() === wanted) return m.content || ''
  }
  return ''
}

// ---------------------------------------------------------------------------
// Checks + scoring
// ---------------------------------------------------------------------------

const GROUPS = [
  { key: 'meta', zh: '标题与描述', en: 'Title & description' },
  { key: 'schema', zh: '结构化数据', en: 'Structured data' },
  { key: 'ai', zh: 'AI 可读性', en: 'AI readability' },
  { key: 'crawl', zh: '抓取与索引', en: 'Crawl & index' },
  { key: 'content', zh: '内容与关键词', en: 'Content & keywords' },
] as const

export type AuditCheck = {
  id: string
  group: string
  label: string
  status: CheckStatus
  detail: string
  fix: string
}

export type AuditGroup = {
  key: string
  label_zh: string
  label_en: string
  score: number
  max: number
  count: number
}

export type AuditResult = {
  ok: true
  rubric: number
  url: string
  final_url: string
  status: number
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'E'
  groups: AuditGroup[]
  checks: AuditCheck[]
  summary: { pass: number; warn: number; fail: number }
  title: string
  facts: Record<string, string | number>
}

function check(
  id: string,
  group: string,
  label: string,
  status: CheckStatus,
  detail: string,
  fix = '',
): AuditCheck {
  return { id, group, label, status, detail, fix }
}

/**
 * Collect `@type` values, following `@graph`.
 *
 * Almost every CMS and framework emits one block shaped
 * `{ "@context": …, "@graph": [WebSite, WebPage, Organization] }`, so reading
 * only the top level reports "no schema type" on a page that has three of
 * them — and then tells the visitor to add data they already ship. The depth
 * cap is there because `@graph` can nest, and a hostile document should not
 * be able to spin this.
 */
function collectTypes(node: unknown, out: string[], depth = 0): void {
  for (const item of collectNodes(node, depth)) {
    const type = item['@type']
    if (Array.isArray(type)) out.push(...type.map(String))
    else if (type) out.push(String(type))
  }
}

/** Every node in a block, following `@graph` — the shape most CMSs emit. */
function collectNodes(node: unknown, depth = 0, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (depth > 3 || node === null || typeof node !== 'object') return out

  if (Array.isArray(node)) {
    for (const item of node) collectNodes(item, depth + 1, out)
    return out
  }

  const obj = node as Record<string, unknown>
  if (obj['@type']) out.push(obj)
  if (obj['@graph']) collectNodes(obj['@graph'], depth + 1, out)
  return out
}

export async function audit(rawUrl: string, lang: AuditLang = 'en', options?: AuditOptions): Promise<AuditResult> {
  const t = (zh: string, en: string) => (lang === 'zh' ? zh : en)

  const target = normalizeUrl(rawUrl)
  const res = await fetchPage(target, options)

  const finalUrl = res.finalUrl
  let final: URL
  try {
    final = new URL(finalUrl)
  } catch {
    final = target
  }
  const origin = final.origin
  const host = final.hostname

  // Start the three file probes now; they overlap with the parsing below
  // instead of stacking three timeouts after it.
  const llmsProbe = probe(origin + '/llms.txt', false, options)
  const robotsProbe = probe(origin + '/robots.txt', true, options)
  const sitemapProbe = probe(origin + '/sitemap.xml', false, options)

  const page = parseHtml(res.html)
  const [llms, robotsTxt, sitemap] = await Promise.all([llmsProbe, robotsProbe, sitemapProbe])

  const checks: AuditCheck[] = []

  // ---------- 1. title & description ----------
  const title = page.title.trim()
  if (!title) {
    checks.push(
      check('title', 'meta', t('Title 标签', 'Title tag'), 'fail',
        t('页面没有 <title>', 'No <title> element'),
        t('加一个 15–60 字符的标题', 'Add a 15-60 character title')),
    )
  } else {
    const len = title.length
    const ok = len >= 15 && len <= 60
    checks.push(
      check('title', 'meta', t('Title 标签', 'Title tag'), ok ? 'pass' : 'warn',
        t(`${len} 字符：${title.slice(0, 70)}`, `${len} characters: ${title.slice(0, 70)}`),
        ok ? '' : t('控制在 15–60 字符', 'Keep it between 15 and 60 characters')),
    )
  }

  const desc = metaOf(page, 'description')
  if (!desc) {
    checks.push(
      check('desc', 'meta', t('Meta 描述', 'Meta description'), 'fail',
        t('缺失', 'Missing'),
        t('写一段 50–160 字符的描述', 'Write a 50-160 character description')),
    )
  } else {
    const len = desc.length
    const ok = len >= 50 && len <= 160
    checks.push(
      check('desc', 'meta', t('Meta 描述', 'Meta description'), ok ? 'pass' : 'warn',
        t(`${len} 字符`, `${len} characters`),
        ok ? '' : t('控制在 50–160 字符', 'Keep it between 50 and 160 characters')),
    )
  }

  const ogTitle = metaOf(page, 'og:title', 'property')
  const ogImg = metaOf(page, 'og:image', 'property')
  const ogOk = Boolean(ogTitle && ogImg)
  checks.push(
    check('og', 'meta', 'Open Graph', ogOk ? 'pass' : 'warn',
      ogOk
        ? t('title + image 都有', 'title + image present')
        : t('缺 og:title 或 og:image', 'og:title or og:image missing'),
      ogOk
        ? ''
        : t('补 og:title / og:description / og:image，分享卡片才正常',
            'Add og:title / og:description / og:image so share cards render')),
  )

  const tw = metaOf(page, 'twitter:card')
  checks.push(
    check('twitter', 'meta', 'Twitter card', tw ? 'pass' : 'warn',
      tw || t('缺失', 'Missing'),
      tw ? '' : 'Add <meta name="twitter:card" content="summary_large_image">'),
  )

  // ---------- 2. structured data ----------
  const blocks = page.jsonld.filter((b) => b.trim())
  const types: string[] = []
  const nodes: Record<string, unknown>[] = []
  let bad = 0
  let noContext = 0

  for (const block of blocks) {
    let data: unknown
    try {
      data = JSON.parse(block)
    } catch {
      bad += 1
      continue
    }
    if (!block.includes('"@context"')) noContext += 1
    collectTypes(data, types)
    collectNodes(data, 0, nodes)
  }

  let jsonldStatus: CheckStatus
  let jsonldDetail: string
  if (!blocks.length) {
    jsonldStatus = 'fail'
    jsonldDetail = t('没有找到 JSON-LD', 'No JSON-LD found')
  } else if (bad) {
    jsonldStatus = 'warn'
    jsonldDetail = t(`${blocks.length} 段里有 ${bad} 段解析失败`, `${bad} of ${blocks.length} blocks do not parse`)
  } else if (noContext) {
    jsonldStatus = 'warn'
    jsonldDetail = t(`${noContext} 段缺 @context`, `${noContext} block(s) missing @context`)
  } else {
    jsonldStatus = 'pass'
    jsonldDetail = types.length
      ? t(
          `${blocks.length} 段，类型：${[...new Set(types)].sort().slice(0, 5).join(', ')}`,
          `${blocks.length} block(s), types: ${[...new Set(types)].sort().slice(0, 5).join(', ')}`,
        )
      : t(`${blocks.length} 段，未声明 @type`, `${blocks.length} block(s), no @type declared`)
  }
  checks.push(
    check('jsonld', 'schema', 'JSON-LD', jsonldStatus, jsonldDetail,
      jsonldStatus === 'pass'
        ? ''
        : t('加 SoftwareApplication / Product 结构化数据，@context 用 https://schema.org',
            'Add SoftwareApplication / Product JSON-LD with @context https://schema.org')),
  )

  const goodTypes = ['Product', 'SoftwareApplication', 'WebApplication', 'Organization', 'Article']
  const typeOk = types.some((ty) => goodTypes.includes(ty))
  checks.push(
    check('schema_type', 'schema', t('Schema 类型匹配', 'Schema type match'),
      typeOk ? 'pass' : 'warn',
      [...new Set(types)].sort().slice(0, 5).join(', ') || t('无', 'none'),
      typeOk
        ? ''
        : t('用 Product 或 SoftwareApplication 描述你的产品',
            'Describe the product as Product or SoftwareApplication')),
  )

  // Required properties, per type. Markup that parses is not markup that
  // earns a rich result: a Product without `offers` validates as JSON and
  // shows nothing in the SERP.
  const missing: string[] = []
  for (const node of nodes) {
    const nodeTypes = Array.isArray(node['@type']) ? node['@type'].map(String) : [String(node['@type'])]
    for (const ty of nodeTypes) {
      const required = SCHEMA_REQUIRED[ty]
      if (!required) continue
      const absent = required.filter((key) => node[key] === undefined || node[key] === null || node[key] === '')
      if (absent.length) missing.push(`${ty} 缺 ${absent.join(' / ')}`)
    }
  }
  checks.push(
    check('schema_required', 'schema', t('Schema 必填字段', 'Schema required fields'),
      missing.length ? 'warn' : 'pass',
      missing.length
        ? missing.slice(0, 3).join('；')
        : nodes.length
          ? t('已声明的类型字段齐全', 'Declared types carry their required properties')
          : t('无结构化数据可检查', 'Nothing to check'),
      missing.length
        ? t(`补上：${missing[0]}`, `Add: ${missing[0]}`)
        : ''),
  )

  const deprecated = [...new Set(types.filter((ty) => SCHEMA_DEPRECATED.has(ty)))]
  checks.push(
    check('schema_deprecated', 'schema', t('未用已下线的类型', 'No retired schema types'),
      deprecated.length ? 'warn' : 'pass',
      deprecated.length
        ? t(`用了 ${deprecated.join('、')}`, `uses ${deprecated.join(', ')}`)
        : t('没有已下线的类型', 'none of the retired types'),
      deprecated.length
        ? t('HowTo 从 2023 年起、其余 2025–2026 陆续下线，不再产生富媒体结果；留着不报错，但也不会有任何效果',
            'HowTo went in 2023 and the rest were retired through 2025-2026 — they no longer produce rich results')
        : ''),
  )

  // ---------- 3. AI readability ----------
  const h1s = page.headings.filter((h) => h.level === 1)
  const h1Ok = h1s.length === 1
  checks.push(
    check('h1', 'ai', t('唯一 H1', 'Single H1'),
      h1Ok ? 'pass' : h1s.length ? 'warn' : 'fail',
      t(`${h1s.length} 个 H1`, `${h1s.length} H1`),
      h1Ok ? '' : t('每页只保留一个 H1，写清页面主题', 'Keep exactly one H1 that names the page topic')),
  )

  const semanticOk = page.semantic.has('main') || page.semantic.has('article')
  checks.push(
    check('semantic', 'ai', t('语义化结构', 'Semantic structure'),
      semanticOk ? 'pass' : 'warn',
      page.semantic.size
        ? t('含 ', 'has ') + [...page.semantic].sort().join(', ')
        : t('全是 div', 'divs only'),
      semanticOk
        ? ''
        : t('用 <main> / <article> 包内容，AI 更好切块',
            'Wrap content in <main> / <article> so AI can chunk it')),
  )

  const plain = page.text.join(' ').replace(/\s+/g, ' ').trim()
  const words = plain ? plain.split(/\s+/).length : 0
  checks.push(
    check('text', 'ai', t('正文可提取', 'Extractable text'),
      words >= 200 ? 'pass' : 'warn',
      t(`约 ${words} 词`, `about ${words} words`),
      words >= 200
        ? ''
        : t('正文太短，AI 没有可引用的内容', 'Too little text for AI search to quote')),
  )

  const llmsOk = llms.status === 200 && llms.size > 20
  checks.push(
    check('llms', 'ai', 'llms.txt', llmsOk ? 'pass' : 'warn',
      llmsOk ? t('存在', 'present') : t('未找到 /llms.txt', 'no /llms.txt'),
      llmsOk
        ? ''
        : t('放一个 llms.txt，告诉 AI 你的站点结构',
            'Add an llms.txt that describes your site to AI crawlers')),
  )

  // Who may cite you. Reads the robots.txt rules, not just its status code —
  // a 200 that disallows OAI-SearchBot removes the site from ChatGPT Search
  // and nothing on the page itself would ever show it.
  const robotsOkForRules = robotsTxt.status === 200
  // A 404 means there is no robots.txt at all, so nothing is disallowed — that
  // is a pass *for this check*. The missing file is already flagged by the
  // `robots` check; charging the same absent file twice would turn one fix
  // into two lost points.
  const robotsAbsent = robotsTxt.status === 404
  const rules = robotsRules(robotsTxt.text)
  const blockedBots = robotsOkForRules
    ? AI_SEARCH_BOTS.filter((bot) => blocksEverything(rules, bot))
    : []
  let crawlerStatus: CheckStatus
  if (robotsOkForRules) {
    crawlerStatus = blockedBots.length === AI_SEARCH_BOTS.length
      ? 'fail'
      : blockedBots.length ? 'warn' : 'pass'
  } else {
    // 403 / 5xx / timeout: the file may exist and block us. Unknown is not fine.
    crawlerStatus = robotsAbsent ? 'pass' : 'warn'
  }
  checks.push(
    check('ai_crawlers', 'ai', t('AI 搜索爬虫放行', 'AI search crawlers allowed'),
      crawlerStatus,
      robotsOkForRules
        ? blockedBots.length
          ? t(`robots.txt 挡住了 ${blockedBots.join('、')}`, `robots.txt blocks ${blockedBots.join(', ')}`)
          : t('OAI-SearchBot / Claude-SearchBot / PerplexityBot 都可进',
              'OAI-SearchBot, Claude-SearchBot and PerplexityBot are all allowed')
        : robotsAbsent
          ? t('没有 robots.txt，等于全部放行', 'No robots.txt — nothing is disallowed')
          : t('robots.txt 读不到（非 200），无法判断是否放行',
              'robots.txt could not be read (non-200) — cannot tell whether they are allowed'),
      crawlerStatus === 'pass'
        ? ''
        : t('这三个是「搜索」爬虫，不是训练爬虫：放行它们，AI 才可能在回答里引用你。挡 GPTBot / ClaudeBot 只影响训练，不影响搜索——这两个常被搞混',
            'These three are search crawlers, not training crawlers: allow them and AI answers can cite you. Blocking GPTBot / ClaudeBot only affects training, not search — the two are routinely conflated')),
  )

  // Question-shaped headings are how a page matches the query it answers.
  // "What is X?" and "How to do Y" both count — plenty of good pages phrase
  // the heading without a question mark.
  const QUESTION_WORD = /^(how|what|why|when|where|which|who|can|is|are|do|does|should)\b|^(如何|怎么|怎样|为什么|什么|哪些|是否)/i
  const questionHeadings = page.headings.filter(
    (h) => /[?？]\s*$/.test(h.text) || QUESTION_WORD.test(h.text),
  )
  checks.push(
    check('qa_headings', 'ai', t('问题式标题', 'Question headings'),
      questionHeadings.length ? 'pass' : 'warn',
      questionHeadings.length
        ? t(`${questionHeadings.length} 个`, `${questionHeadings.length}`)
        : t('没有以问句结尾的标题', 'no heading is phrased as a question'),
      questionHeadings.length
        ? ''
        : t('至少放一个和用户搜索词同形的问题小节（「XX 是什么 / 怎么选」），AI 更容易整段引用',
            'Add at least one heading phrased the way people search (e.g. "What is X?"), so AI can quote the section whole')),
  )

  // E-E-A-T: who is behind the page. Machine-readable, so it is checkable.
  //
  // `fail` is reserved for pages with no identity *and* no About/Contact link.
  // Calling out a site that clearly names its owner in the footer as having
  // "nothing that identifies who is behind it" is the kind of false alarm
  // that costs a tool its credibility — MDN did exactly that on the first run.
  const hasAuthorMeta = Boolean((metaOf(page, 'author') || '').trim())
  const hasAboutLink = page.anchors.some((a) => /\/(about|contact|team|company)(\/|$|\?|#)/i.test(a.href || ''))
  const orgNode = nodes.find((n) => {
    const ty = Array.isArray(n['@type']) ? n['@type'].map(String) : [String(n['@type'])]
    return ty.some((x) => x === 'Organization' || x === 'Person')
  })
  const orgNamed = Boolean(orgNode?.name)
  const orgLinked = Boolean(orgNode?.url || orgNode?.sameAs)
  let authorityStatus: CheckStatus
  let authorityDetail: string
  if (orgNamed && orgLinked) {
    authorityStatus = 'pass'
    authorityDetail = t('结构化数据里有带链接的组织 / 作者', 'Organization or Person with a URL in structured data')
  } else if (orgNamed || hasAuthorMeta) {
    authorityStatus = 'warn'
    authorityDetail = hasAuthorMeta
      ? t('只有 meta author，没有结构化归属', 'Only a meta author tag, no structured identity')
      : t('有名称但没有 url / sameAs', 'Named, but no url or sameAs')
  } else if (hasAboutLink) {
    authorityStatus = 'warn'
    authorityDetail = t('页面上有关于 / 联系入口，但没有结构化归属', 'About or contact link present, but no structured identity')
  } else {
    authorityStatus = 'fail'
    authorityDetail = t('看不出这页是谁写的', 'Nothing identifies who is behind the page')
  }
  checks.push(
    check('authority', 'ai', t('作者 / 组织归属', 'Author or org identity'), authorityStatus, authorityDetail,
      authorityStatus === 'pass'
        ? ''
        : t('加 Organization 或 Person 结构化数据，带 name + url / sameAs；这是 E-E-A-T 里机器唯一读得到的部分',
            'Add Organization or Person JSON-LD with name + url / sameAs — the only part of E-E-A-T a machine can read')),
  )

  // ---------- 4. crawl & index ----------
  const robotsMeta = metaOf(page, 'robots')
  const noindex = robotsMeta.toLowerCase().includes('noindex')
  checks.push(
    check('noindex', 'crawl', t('可被索引', 'Indexable'),
      noindex ? 'fail' : 'pass',
      noindex ? 'noindex' : t('没有 noindex', 'no noindex'),
      noindex ? t('删掉 noindex', 'Remove the noindex directive') : ''),
  )

  let canonical = ''
  for (const l of page.links) {
    if ((l.rel || '').toLowerCase() === 'canonical') canonical = l.href || ''
  }
  checks.push(
    check('canonical', 'crawl', 'Canonical', canonical ? 'pass' : 'warn',
      canonical || t('缺失', 'Missing'),
      canonical ? '' : 'Add <link rel="canonical">'),
  )

  const robotsOk = robotsTxt.status === 200
  const sitemapOk = sitemap.status === 200
  checks.push(
    check('robots', 'crawl', 'robots.txt', robotsOk ? 'pass' : 'warn',
      robotsOk ? t('存在', 'present') : t('未找到', 'not found'),
      robotsOk ? '' : t('加 robots.txt 并指向 sitemap', 'Add robots.txt pointing at your sitemap')),
  )
  checks.push(
    check('sitemap', 'crawl', 'sitemap.xml', sitemapOk ? 'pass' : 'warn',
      sitemapOk ? t('存在', 'present') : t('未找到', 'not found'),
      sitemapOk ? '' : t('生成 sitemap.xml', 'Generate a sitemap.xml')),
  )

  const httpsOk = final.protocol === 'https:'
  checks.push(
    check('https', 'crawl', 'HTTPS', httpsOk ? 'pass' : 'fail',
      final.protocol.replace(':', '').toUpperCase(),
      httpsOk ? '' : t('全站走 HTTPS', 'Serve the whole site over HTTPS')),
  )

  checks.push(
    check('lang', 'crawl', t('lang 属性', 'lang attribute'),
      page.lang ? 'pass' : 'warn',
      page.lang || t('缺失', 'Missing'),
      page.lang ? '' : 'Add <html lang="en">'),
  )

  // hreflang is an "only if you tried" check: a single-language site that
  // never declared one is not wrong, and should not be scored as if it were.
  // A site that *did* declare them and got it half-right is the case worth
  // flagging, because a broken set is worse than none.
  const alternates = page.links.filter(
    (l) => (l.rel || '').toLowerCase().split(/\s+/).includes('alternate') && l.hreflang,
  )
  if (!alternates.length) {
    checks.push(
      check('hreflang', 'crawl', 'hreflang',
        'pass', t('没有声明，单语言页面不需要', 'None declared — a single-language page does not need any'), ''),
    )
  } else {
    const problems: string[] = []
    if (!alternates.some((l) => (l.hreflang || '').toLowerCase() === 'x-default')) {
      problems.push(t('缺 x-default', 'no x-default'))
    }
    if (!alternates.some((l) => (l.href || '').startsWith('http'))) {
      problems.push(t('href 不是绝对地址', 'href is not absolute'))
    }
    const selfLang = (page.lang || '').toLowerCase().split('-')[0]
    const hasSelf = selfLang
      ? alternates.some((l) => (l.hreflang || '').toLowerCase().startsWith(selfLang))
      : true
    if (!hasSelf) problems.push(t('缺指向自身的语言版本', 'no self-referencing entry'))

    checks.push(
      check('hreflang', 'crawl', 'hreflang', problems.length ? 'warn' : 'pass',
        problems.length
          ? `${alternates.length} 条：${problems.join('；')}`
          : t(`${alternates.length} 条，x-default 与自指都在`, `${alternates.length} entries, x-default and self-reference present`),
        problems.length
          ? t('hreflang 必须成对：每个语言都要指回自己，并有一条 x-default；href 用绝对地址',
              'hreflang must be reciprocal: every language points at itself too, plus one x-default, all with absolute URLs')
          : ''),
    )
  }

  // ---------- 5. content ----------
  const wcStatus: CheckStatus = words >= 300 ? 'pass' : words >= 120 ? 'warn' : 'fail'
  checks.push(
    check('wordcount', 'content', t('正文长度', 'Word count'), wcStatus,
      t(`${words} 词`, `${words} words`),
      wcStatus === 'pass'
        ? ''
        : t('正文至少 300 词，才有排名竞争力', 'Aim for 300+ words of real content to compete')),
  )

  const h2s = page.headings.filter((h) => h.level === 2)
  checks.push(
    check('h2', 'content', t('H2 小节', 'H2 sections'),
      h2s.length >= 2 ? 'pass' : 'warn',
      t(`${h2s.length} 个`, `${h2s.length}`),
      h2s.length >= 2
        ? ''
        : t('用 H2 把内容切成 2–5 个小节', 'Split the content into 2-5 H2 sections')),
  )

  const imgs = page.imgs
  // An `alt` attribute that is present but empty is not a miss — it is how you
  // mark a decorative image, and it is the correct markup for one. The defect
  // this check is looking for is the *absent* attribute, which is what a
  // forgotten image looks like. Counting empty alts as failures flagged Apple
  // at 9/47 on the first run, which was the check being wrong, not the page.
  const withAltAttr = imgs.filter((im) => 'alt' in im)
  const descriptive = withAltAttr.filter((im) => (im.alt || '').trim())
  const altRatio = imgs.length ? (withAltAttr.length / imgs.length) * 100 : 100
  const altStatus: CheckStatus = altRatio >= 80 ? 'pass' : altRatio >= 40 ? 'warn' : 'fail'
  const emptyAlts = withAltAttr.length - descriptive.length
  checks.push(
    check('alt', 'content', t('图片 alt 覆盖', 'Image alt coverage'), altStatus,
      t(
        `${descriptive.length}/${imgs.length} 有描述${emptyAlts ? `（${emptyAlts} 张空 alt，按装饰图处理）` : ''}`,
        `${descriptive.length}/${imgs.length} described${emptyAlts ? ` (${emptyAlts} with empty alt, treated as decorative)` : ''}`,
      ),
      altStatus === 'pass'
        ? ''
        : t('给每张内容图写 alt；纯装饰图写 alt="" 是对的，别留空属性',
            'Give every content image alt text. For purely decorative images alt="" is correct — but do not omit the attribute')),
  )

  let internal = 0
  for (const a of page.anchors) {
    const href = (a.href || '').trim()
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue
    if (href.startsWith('/') || (href.startsWith('http') && href.includes(host))) internal += 1
  }
  checks.push(
    check('internal', 'content', t('内链数量', 'Internal links'),
      internal >= 5 ? 'pass' : 'warn',
      t(`${internal} 条`, `${internal}`),
      internal >= 5
        ? ''
        : t('正文里加 5 条以上内链', 'Add 5+ internal links in the body')),
  )

  // CLS is a field metric we cannot measure from HTML, but its single most
  // common cause is measurable: an <img> with no width/height reserves no
  // space, so the text below it jumps when the image lands.
  //
  // Capped at `warn`: a site can also reserve space with CSS `aspect-ratio`,
  // which we cannot see from here. Apple ships 0/47 width/height attributes
  // and has no CLS problem — calling that a `fail` would be a false alarm on
  // one of the best-optimised pages on the web.
  const sized = imgs.filter((im) => im.width && im.height)
  const sizedRatio = imgs.length ? (sized.length / imgs.length) * 100 : 100
  const dimsStatus: CheckStatus = sizedRatio >= 80 ? 'pass' : 'warn'
  checks.push(
    check('img_dims', 'content', t('图片宽高属性', 'Image dimensions'), dimsStatus,
      `${sized.length}/${imgs.length}`,
      dimsStatus === 'pass'
        ? ''
        : t('给 <img> 加 width / height，浏览器才能预留位置——这是 CLS 最常见的成因；如果你用 CSS aspect-ratio 固定了比例，这条可以忽略',
            'Add width / height to <img> so the browser reserves space — the most common cause of CLS. If you pin the ratio with CSS aspect-ratio, ignore this')),
  )

  // Structure AI answers can lift. A wall of <p> is harder to quote than the
  // same facts as a list or a comparison table.
  const structureTags = [...page.structured].sort()
  checks.push(
    check('list_table', 'content', t('列表 / 表格', 'Lists & tables'),
      structureTags.length ? 'pass' : 'warn',
      structureTags.length ? t('含 ', 'has ') + structureTags.join(', ') : t('只有段落', 'paragraphs only'),
      structureTags.length
        ? ''
        : t('把并列的信息做成 <ul> 或对比表，AI 回答更容易整块引用',
            'Turn parallel facts into a <ul> or a comparison table — AI answers quote those whole')),
  )

  // ---------- score ----------
  const weight: Record<CheckStatus, number> = { pass: 1, warn: 0.5, fail: 0 }
  const groups: AuditGroup[] = []
  let total = 0

  for (const g of GROUPS) {
    const items = checks.filter((c) => c.group === g.key)
    const got = items.reduce((sum, c) => sum + weight[c.status], 0)
    const score = items.length ? Math.round((got / items.length) * 20) : 0
    groups.push({ key: g.key, label_zh: g.zh, label_en: g.en, score, max: 20, count: items.length })
    total += score
  }

  const fails = checks.filter((c) => c.status === 'fail')
  const warns = checks.filter((c) => c.status === 'warn')
  const grade = total >= 90 ? 'A' : total >= 75 ? 'B' : total >= 60 ? 'C' : total >= 40 ? 'D' : 'E'

  return {
    ok: true,
    // Bumped whenever the check list changes. Two reports are only comparable
    // when their rubric matches; the page shows the count so a screenshot from
    // before the change cannot be read as a drop in quality.
    rubric: 2,
    url: rawUrl,
    final_url: finalUrl,
    status: res.status,
    score: total,
    grade,
    groups,
    checks,
    summary: {
      pass: checks.length - fails.length - warns.length,
      warn: warns.length,
      fail: fails.length,
    },
    title: title.slice(0, 120),
    // Raw measurements, kept apart from the human labels so a later report
    // page can decide what is worth indexing without re-parsing prose.
    facts: {
      words,
      title: title.slice(0, 160),
      title_len: title.length,
      desc_len: desc.length,
      status: res.status,
      final_url: finalUrl,
      host,
      scheme: final.protocol.replace(':', ''),
      h1_count: h1s.length,
      h2_count: h2s.length,
      jsonld_blocks: blocks.length,
      blocked_ai_crawlers: blockedBots.join(', '),
      checked_at: Math.floor(Date.now() / 1000),
    },
  }
}
