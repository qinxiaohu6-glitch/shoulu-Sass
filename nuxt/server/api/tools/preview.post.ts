/**
 * POST /api/tools/preview — "paste a link, fill the form".
 *
 * Reads one public HTML page and answers the fields the submit form asks for:
 * name, tagline, description, logo, plus a best-guess category and the
 * catalogue tags the page actually mentions. Nothing is stored: the submitter
 * reviews every value in the form before `/api/submit` writes anything.
 *
 * Deliberately rule-based, no model. The answer has to be reproducible, and a
 * wrong guess is visible in the form where it can be corrected — an invented
 * sentence would read like copy the submitter never wrote.
 *
 * Guard rails, because this is a public endpoint that fetches a URL a stranger
 * supplied: http(s) only, private hosts refused, 6s timeout, 600 KB cap, HTML
 * only, `no-store`.
 */

import catalogJson from '~~/shared/content/catalog.json'
import { cleanUrl, SubmissionError } from '../../utils/submissions'

const FETCH_TIMEOUT_MS = 6000
const MAX_BYTES = 600_000
const MAX_NAME = 60
const MAX_SHORT = 200
const MAX_LONG = 2000
const MAX_TAGS = 4

const CATALOG = catalogJson as unknown as {
  categories: { slug: string }[]
  tags: { name_en: string }[]
}

const CATEGORY_SLUGS = new Set(CATALOG.categories.map((c) => c.slug))
const TAG_NAMES = new Set(CATALOG.tags.map((t) => t.name_en))

/**
 * Deliberately phrase-only, and deliberately narrow.
 *
 * The first version searched the whole visible page text, and a single word
 * like "video" or "music" in a footer was enough to file python.org under
 * Audio. Guessing wrong is worse than not guessing: the submitter sees a
 * confident-looking category and does not check it. These rules are matched
 * against metadata only (title / og:description / keywords), so an unmatched
 * page leaves the field empty and the submitter picks one.
 */
const CATEGORY_RULES: { slug: string; words: string[] }[] = [
  { slug: 'video', words: ['video call', 'video chat', 'video generation', 'text to video', 'video editor', 'webcam', 'webinar', 'video conferencing'] },
  { slug: 'audio', words: ['text to speech', 'speech to text', 'voice generator', 'voiceover', 'music generation', 'audio editor', 'transcription', 'text-to-speech'] },
  { slug: 'image', words: ['image generation', 'text to image', 'ai image', 'image editor', 'logo maker', 'photo editor', 'graphic design', 'text-to-image'] },
  { slug: 'chatbots', words: ['ai assistant', 'chatbot', 'chat with ai', 'conversational ai', 'large language model', 'llm', 'gpt'] },
  { slug: 'coding', words: ['developer tools', 'code assistant', 'code editor', 'programming', 'software development', 'api platform', 'sdk', 'github'] },
  { slug: 'writing', words: ['copywriting', 'ai writing', 'paraphrase', 'grammar checker', 'blog writer', 'content generator'] },
  { slug: 'productivity', words: ['project management', 'productivity app', 'workflow automation', 'task management', 'note taking'] },
  { slug: 'research', words: ['research tool', 'search engine', 'knowledge base', 'academic search', 'citation', 'paper summary'] },
]

const TAG_RULES: { name: string; words: string[] }[] = [
  { name: 'Text to Speech', words: ['text to speech', 'text-to-speech', 'voiceover'] },
  { name: 'Video Generation', words: ['video generation', 'text-to-video', 'generate video'] },
  { name: 'Image Generation', words: ['image generation', 'text-to-image', 'generate image'] },
  { name: 'App Builder', words: ['app builder', 'no-code', 'low-code'] },
  { name: 'Code Assistant', words: ['code assistant', 'copilot', 'coding assistant'] },
  { name: 'Open Source', words: ['open source', 'open-source'] },
  { name: 'Presentation', words: ['presentation maker', 'slides generator'] },
  { name: 'Meeting', words: ['video meeting', 'video conferencing'] },
  { name: 'Chatbot', words: ['chatbot', 'ai chat', 'chat with ai'] },
  { name: 'Agent', words: ['ai agent', 'autonomous agent', 'agentic'] },
  { name: 'Search', words: ['search engine', 'semantic search'] },
  { name: 'Writing', words: ['copywriting', 'ai writing'] },
  { name: 'Music', words: ['music generation', 'compose music'] },
  { name: 'Avatar', words: ['ai avatar', 'avatar generator'] },
  { name: 'API', words: ['api platform', 'developer api', 'rest api'] },
]

function tidy(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
}

/** `name="x"`, `name='x'` and `name=x` in one pass. */
function attrsOf(tag: string): Map<string, string> {
  const map = new Map<string, string>()
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
  let match: RegExpExecArray | null
  while ((match = re.exec(tag))) {
    map.set((match[1] ?? '').toLowerCase(), decodeEntities(match[3] ?? match[4] ?? match[5] ?? ''))
  }
  return map
}

function metaOf(html: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = attrsOf(tag)
    const key = (attrs.get('property') || attrs.get('name') || '').toLowerCase()
    const content = attrs.get('content')
    if (key && content && !map.has(key)) map.set(key, content)
  }
  return map
}

function titleOf(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? tidy(decodeEntities(match[1] ?? '')) : ''
}

/** "Foo — The best bar" → "Foo"; a title with no separator stays whole. */
function brandOf(title: string): string {
  // Marketing boilerplate is not a product name: "Welcome to Python.org"
  // would otherwise become the listing's title verbatim.
  const stripped = tidy(title.replace(/^(?:welcome to|home\s*[|:\-–—]\s*)/i, ''))
  const parts = stripped.split(/\s+[|\-–—·]\s+/)
  const head = tidy(parts[0] ?? '')
  return head.length >= 2 ? head : stripped || title
}

function blockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host === '::1' || host === '[::1]' || host === '0.0.0.0') return true
  return /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)
}

function guessCategory(haystack: string): string {
  for (const rule of CATEGORY_RULES) {
    if (!CATEGORY_SLUGS.has(rule.slug)) continue
    if (rule.words.some((word) => haystack.includes(word))) return rule.slug
  }
  return ''
}

function guessTags(haystack: string): string[] {
  const tags: string[] = []
  for (const rule of TAG_RULES) {
    if (tags.length >= MAX_TAGS) break
    if (!TAG_NAMES.has(rule.name)) continue
    if (rule.words.some((word) => haystack.includes(word))) tags.push(rule.name)
  }
  return tags
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ url?: string }>(event).catch(() => null)

  let url = ''
  let domain = ''
  try {
    ;[url, domain] = cleanUrl(body?.url)
  } catch (err) {
    if (err instanceof SubmissionError) {
      setResponseStatus(event, 400)
      return { ok: false, reason: err.code }
    }
    throw err
  }

  if (blockedHost(new URL(url).hostname)) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'blocked' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; DirtoolPreview/1.0; +https://dirtool.com/submit)',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en,zh;q=0.8',
      },
    })
  } catch {
    setResponseStatus(event, 502)
    return { ok: false, reason: 'unreachable' }
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    setResponseStatus(event, 502)
    return { ok: false, reason: `http_${response.status}` }
  }

  const type = (response.headers.get('content-type') || '').toLowerCase()
  if (!type.includes('html')) {
    setResponseStatus(event, 415)
    return { ok: false, reason: 'not_html' }
  }

  const raw = await response.text()
  const html = raw.slice(0, MAX_BYTES)
  const meta = metaOf(html)
  const title = titleOf(html)

  const ogTitle = tidy(meta.get('og:title') || meta.get('twitter:title') || '')
  const name = clip(brandOf(ogTitle || title) || domain, MAX_NAME)

  const description = tidy(
    meta.get('og:description') || meta.get('twitter:description') || meta.get('description') || '',
  )

  // The submit API refuses a tagline under 20 characters. A page without a
  // usable meta description gets an obvious placeholder instead of a chunk of
  // navigation text; it lands in a visible field, so it is one edit away.
  const short = clip(
    description.length >= 20 ? description : `${name} — ${domain} — official website`,
    MAX_SHORT,
  )

  // Only a real description belongs in the long-form section. Visible page
  // text carries cookie notices, "enable JavaScript" fallbacks and nav labels;
  // publishing that as a product introduction is worse than leaving the field
  // empty for the submitter to fill in themselves.
  const long = description.length >= 120 ? clip(description, MAX_LONG) : ''

  let logo = ''
  const rawLogo = meta.get('og:image') || meta.get('twitter:image') || ''
  if (rawLogo) {
    try {
      const resolved = new URL(rawLogo, url)
      if (/^https?:$/.test(resolved.protocol)) logo = resolved.href
    } catch {
      // A malformed `og:image` is not worth failing the whole preview over.
    }
  }

  // `maker` and `logo` already have columns in `submissions` — the submit form
  // simply never sent them. Without them a published listing renders with a
  // two-letter placeholder and no maker line, while a curated one has both.
  const maker = clip(
    tidy(meta.get('og:site_name') || meta.get('application-name') || ''),
    60,
  )

  // Metadata only. Visible page text is full of incidental words ("video" in
  // a footer, "music" in a nav link); matching against it produced confident
  // wrong answers. An unmatched page leaves category/tags empty on purpose.
  const haystack = `${ogTitle} ${title} ${name} ${description} ${meta.get('keywords') || ''} ${maker}`
    .toLowerCase()
    .slice(0, 4000)

  setResponseHeader(event, 'cache-control', 'no-store')
  return {
    ok: true,
    url,
    domain,
    name,
    short,
    long,
    logo,
    maker,
    category: guessCategory(haystack),
    tags: guessTags(haystack),
  }
})
