/**
 * Where a product icon actually lives.
 *
 * The catalogue stores repo-relative paths (`assets/img/icons/claude.png`) that
 * are served out of `public/`. A submission stores whatever absolute URL the
 * maker typed into the form. Prefixing the second kind with `/` produces
 * `/https://…`, which the browser resolves against our own host and 404s — so
 * the two are told apart here instead of at every call site.
 */
export function logoSrc(value: string): string {
  const v = String(value || '').trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `/${v.replace(/^\/+/, '')}`
}
