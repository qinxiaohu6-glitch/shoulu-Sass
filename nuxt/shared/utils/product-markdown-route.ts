/**
 * English product markdown lives at `/products/:slug.md`.
 *
 * That path must not be a Nitro file route. Nitro 2 scans
 * `routes/products/[slug].md.ts` into `/products/:slug.md`, and radix3 treats
 * a section that starts with `:` as one whole-segment placeholder. The param
 * is named `slug.md`, so both `/products/chatgpt` and `/products/chatgpt.md`
 * match and `getRouterParam(event, 'slug')` is empty. The handler then
 * answers the 9-byte `Not found` before the Nuxt page runs.
 */
const PRODUCT_MARKDOWN = /^\/products\/([^/]+)\.md\/?$/i

export function productMarkdownSlug(pathname: string): string | null {
  const match = PRODUCT_MARKDOWN.exec(pathname)
  const raw = match?.[1]
  if (!raw) return null
  let slug: string
  try {
    slug = decodeURIComponent(raw)
  } catch {
    return null
  }
  slug = slug.trim()
  if (!slug || slug.includes('/') || slug.includes('\\') || slug.includes('\0')) return null
  return slug
}
