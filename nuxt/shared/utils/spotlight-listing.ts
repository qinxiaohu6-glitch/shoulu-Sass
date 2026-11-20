/**
 * Which live listing a Spotlight belongs to.
 *
 * `spotlight.listing_slug` is written once, when the article is submitted, and
 * a listing can move afterwards: deleting it and re-adding the same product
 * mints a new slug from whatever name was typed the second time. Following the
 * record by slug alone turned a published article into a 404 the moment that
 * happened — and the sitemap kept advertising the URL.
 *
 * So the slug is tried first, then the product's own host, which is what
 * actually identifies the product. The host is not a guess: it comes from the
 * article's own `product_url`, which the submitter supplied.
 *
 * Both the page and the sitemap resolve through here, so a page the sitemap
 * lists is a page that renders.
 */

/** `https://www.PeachChat.live/x` → `peachchat.live`. Empty when unparseable. */
export function hostOf(url: string): string {
  const raw = String(url || '').trim().toLowerCase()
  if (!raw) return ''
  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function findSpotlightListing<T extends { slug: string; url?: string }>(
  listingSlug: string,
  productUrl: string,
  listings: readonly T[],
): T | null {
  const wanted = String(listingSlug || '').trim()
  if (wanted) {
    const bySlug = listings.find((entry) => entry.slug === wanted)
    if (bySlug) return bySlug
  }

  const host = hostOf(productUrl)
  if (!host) return null
  return listings.find((entry) => hostOf(entry.url ?? '') === host) ?? null
}
