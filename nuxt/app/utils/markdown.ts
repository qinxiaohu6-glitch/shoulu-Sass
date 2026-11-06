/**
 * Markdown rendering for blog posts.
 *
 * Ported from `src/components/markdown-content.tsx` in the source. Same three
 * behaviours, because they are load-bearing rather than cosmetic:
 *
 *  - **Heading ids.** Guest-post authors link to their own sections, so the
 *    headings need stable anchors. `generateHeadingId` is copied verbatim
 *    (lowercase, strip punctuation, spaces to dashes) — a different slugifier
 *    would silently break links that already point at `#some-section`.
 *  - **External links.** `nofollow noopener` always, plus `sponsored` on paid
 *    content, which is what Google's link-scheme policy asks for on a paid
 *    placement.
 *  - **utm tagging.** Links inside a paid post carry `utm_source`/`utm_medium`
 *    so the linked site can see the traffic came from here. Links that already
 *    carry any `utm_` parameter are the author's own tracking and are left
 *    alone.
 *
 * The source runs `markdown-it` with `html: false`. `marked` has no such flag,
 * so the `html` renderer is overridden to escape raw HTML instead of passing it
 * through — same guarantee (a guest post cannot inject markup), different
 * mechanism.
 *
 * The options are baked into a per-call `Marked` instance rather than read from
 * module state: `marked`'s renderer receives only the token, and a shared
 * mutable "current options" variable would leak between concurrent requests.
 */
import { Marked } from 'marked'

export type MarkdownOptions = {
  /** Paid content: external links also get `rel="sponsored"`. */
  sponsored?: boolean
  /** Tag external links, unless the author already tagged them. */
  utm?: { source: string; medium: string }
}

function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function withUtm(href: string, source: string, medium: string): string {
  try {
    const url = new URL(href)
    for (const key of url.searchParams.keys()) {
      if (key.toLowerCase().startsWith('utm_')) return href
    }
    url.searchParams.set('utm_source', source)
    url.searchParams.set('utm_medium', medium)
    return url.toString()
  } catch {
    return href
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderMarkdown(content: string, options: MarkdownOptions = {}): string {
  if (!content) return ''

  const md = new Marked({ gfm: true, breaks: false })
  md.use({
    renderer: {
      // `html: false` in the source: show the tags, do not run them.
      html(token) {
        return escapeHtml(token.text)
      },
      heading(token) {
        const inner = this.parser.parseInline(token.tokens)
        return `<h${token.depth} id="${generateHeadingId(token.text)}">${inner}</h${token.depth}>\n`
      },
      link(token) {
        let href = token.href
        const external = /^https?:\/\//.test(href)
        if (external && options.utm) {
          href = withUtm(href, options.utm.source, options.utm.medium)
        }
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
        const rel = external
          ? ` rel="${options.sponsored ? 'sponsored nofollow noopener' : 'nofollow noopener'}" target="_blank"`
          : ''
        const inner = this.parser.parseInline(token.tokens)
        return `<a href="${escapeHtml(href)}"${title}${rel}>${inner}</a>`
      },
    },
  })

  return md.parse(content) as string
}
