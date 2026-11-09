/**
 * Product pages live under `/products`. `/tools` is the utility hub.
 * `dr-checker` is that hub's Domain Rating page, so it can never be a product slug.
 */

export const RESERVED_PRODUCT_SLUGS = new Set(['dr-checker'])

export function isReservedProductSlug(slug: string): boolean {
  return RESERVED_PRODUCT_SLUGS.has(slug.trim().toLowerCase())
}

/**
 * Old product URLs (`/tools/claude`, `/zh/tools/claude.html`) move to
 * `/products/…` in one hop. The hub and `/tools/dr-checker` stay put.
 */
export function productRedirect(pathname: string): string | null {
  const bare = pathname.replace(/\.html$/i, '').replace(/\/+$/, '') || '/'
  const zh = bare.startsWith('/zh/')
  const rest = zh ? bare.slice(3) : bare
  const match = rest.match(/^\/tools\/([^/]+)$/)
  if (!match) return null
  let slug = match[1] ?? ''
  try {
    slug = decodeURIComponent(slug)
  } catch {
    return null
  }
  if (!slug || isReservedProductSlug(slug)) return null
  return `${zh ? '/zh' : ''}/products/${slug}`
}
