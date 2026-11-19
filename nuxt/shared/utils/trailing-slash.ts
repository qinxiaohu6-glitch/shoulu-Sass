/**
 * One page, one URL.
 *
 * Nuxt answers `/products` and `/products/` alike, and every page's canonical
 * tag points at itself — so the slash form was not a duplicate that a canonical
 * could consolidate, it was a second self-canonical copy of the same document.
 * The sitemap listed 231 addresses while the site actually served 462.
 *
 * The rule is always "strip", never "add": no page here is a directory index,
 * so there is no path for which the slash is the right spelling. A 301 is the
 * only signal that removes the extra address instead of hinting at it.
 */

/**
 * The clean path, or `null` when the path is already clean.
 *
 * `null` rather than the same string, so a caller cannot redirect a URL to
 * itself and turn a page into a loop.
 */
export function withoutTrailingSlash(pathname: string): string | null {
  if (!pathname.endsWith('/')) return null
  const bare = pathname.replace(/\/+$/, '')
  // `/` is the site root, not a slash hanging off an empty path.
  return bare || null
}
