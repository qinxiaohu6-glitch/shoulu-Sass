/**
 * Product document title. The one-liner is the listing's own short description.
 * A long one-liner is cut to about 60 characters so the title does not become
 * a second paragraph. Features, pricing, and alternatives are not added here.
 */
export function listingDocumentTitle(name: string, oneLiner: string, brand = 'Product Atlas'): string {
  const line = oneLiner.replace(/\s+/g, ' ').trim()
  const short = line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line
  return short ? `${name} — ${short} | ${brand}` : `${name} | ${brand}`
}
