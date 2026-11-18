/**
 * Product Spotlights.
 *
 * A Spotlight is a long-form article about one listing, sold as part of the
 * Featured and Pro tiers — not as a separate SKU. The article lives at its own
 * URL (`/spotlights/<slug>`) and links to the listing page and to the product's
 * own site.
 *
 * Why this is a content registry and not a table yet:
 *
 * The first three to five articles are a pilot. Until one of them earns an
 * impression, a submission form and an admin queue would be machinery around
 * an empty room. A pilot article is an editorial act, so it is written here,
 * reviewed in a pull request, and shipped with the site — the same shape the
 * blog uses. When the pilot proves out, this module's shape is what the table
 * columns become; nothing on the page depends on where the data lives.
 *
 * House rules for anything added below:
 *
 *  - **One product per article.** Not a roundup, not a listicle.
 *  - **The product must already be listed.** A Spotlight is a benefit of a
 *    paid listing, and the article has to link to a live `/products/<slug>`.
 *  - **Only the product's own link is dofollow.** Every other external link in
 *    the body goes through `renderMarkdown`, which forces `nofollow`. That is
 *    what keeps the page a description of a product rather than a link farm.
 *  - **No invented quotes, metrics or users.** If the maker did not supply a
 *    number, the article does not contain one.
 */

export type Spotlight = {
  /** URL segment under /spotlights/. Part of the public address. */
  slug: string
  /** Shown in the header, the product card and the breadcrumb. */
  productName: string
  /** The product's own site. Rendered as the one dofollow link on the page. */
  productUrl: string
  /** Slug of the live listing this article belongs to. */
  listingSlug: string
  /** One line under the title. Not the listing tagline — the article's angle. */
  tagline: string
  /** ISO date. Drives sort order, the sitemap `lastmod` and `datePublished`. */
  publishedAt: string
  /** Byline. A person, or "Product Atlas editorial" when we wrote it. */
  author: string
  /** Markdown body. Rendered by `renderMarkdown`, so raw HTML is escaped. */
  body: string
  /** Optional: the maker's own short bio, if they supplied one. */
  authorBio?: string
  /** Optional: `{ en, zh }`-free on purpose — spotlights are English only. */
  bestFor?: string
  pricingSummary?: string
}

/**
 * The plans whose listing includes a Spotlight. Kept beside the copy that
 * promises it: `pricing.ts` renders the benefit line from the same list, so a
 * tier cannot advertise a Spotlight it does not grant.
 */
export const SPOTLIGHT_PLANS = ['featured', 'pro'] as const

export type SpotlightPlan = (typeof SPOTLIGHT_PLANS)[number]

export function planIncludesSpotlight(plan?: string | null): boolean {
  if (!plan) return false
  return (SPOTLIGHT_PLANS as readonly string[]).includes(plan)
}

/**
 * Published spotlights, newest first. Empty until the first pilot article is
 * written — the index page renders an honest empty state in that case rather
 * than a placeholder article nobody asked for.
 */
export const SPOTLIGHTS: Spotlight[] = []

export function spotlightBySlug(slug: string): Spotlight | undefined {
  return SPOTLIGHTS.find((item) => item.slug === slug)
}

/** Newest first, without mutating the registry. */
export function publishedSpotlights(): Spotlight[] {
  return [...SPOTLIGHTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
}

/** Word count of the body, used by the guidelines page and the tests. */
export function spotlightWords(body: string): number {
  return String(body ?? '').trim().split(/\s+/).filter(Boolean).length
}
