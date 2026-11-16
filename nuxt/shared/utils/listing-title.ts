export interface ListingTitleSections {
  features?: boolean
  pricing?: boolean
  related?: boolean
}

/**
 * Words added to the document title only when that section has content.
 * An empty features block does not count. Related counts only when another
 * live listing in the same category is actually listed.
 */
export function listingSectionLabel(sections: ListingTitleSections = {}): string {
  const parts: string[] = []
  if (sections.features) parts.push('Features')
  if (sections.pricing) parts.push('Pricing')
  if (sections.related) parts.push('Related')
  return parts.join(', ')
}

/**
 * Product document title. The one-liner is the listing's own short description.
 * A long one-liner is cut to about 60 characters so the title does not become
 * a second paragraph. Features, Pricing, and Related are appended only when
 * the caller says that section has content.
 */
export function listingDocumentTitle(
  name: string,
  oneLiner: string,
  brand = 'Product Atlas',
  sections?: ListingTitleSections,
): string {
  const line = oneLiner.replace(/\s+/g, ' ').trim()
  const short = line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line
  const core = short ? `${name} — ${short}` : name
  const extra = listingSectionLabel(sections)
  return extra ? `${core} — ${extra} | ${brand}` : `${core} | ${brand}`
}
