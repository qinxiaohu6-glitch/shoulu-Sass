/**
 * Where a product icon actually lives, and which URLs may be stored.
 *
 * The catalogue stores repo-relative paths (`assets/img/icons/claude.png`) that
 * are served out of `public/`. A submission stores whatever absolute URL the
 * maker typed into the form. Prefixing the second kind with `/` produces
 * `/https://…`, which the browser resolves against our own host and 404s — so
 * the two are told apart here instead of at every call site.
 *
 * New submissions only accept an absolute http(s) URL. Empty, `javascript:`,
 * `data:` and a bare filename are rejected. Existing rows that already lack a
 * logo are left alone — this check gates new writes, it does not delete the queue.
 */

export function logoSrc(value: string): string {
  const v = String(value || '').trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `/${v.replace(/^\/+/, '')}`
}

const LOGO_MAX = 500

export function legalLogoUrl(raw: unknown): string {
  const logo = String(raw ?? '').trim()
  if (!logo || logo.length > LOGO_MAX || /\s/.test(logo)) return ''
  let url: URL
  try {
    url = new URL(logo)
  } catch {
    return ''
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
  if (!url.hostname) return ''
  return logo
}
