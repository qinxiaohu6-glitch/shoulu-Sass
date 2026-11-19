/**
 * Product Spotlights — the shared half.
 *
 * A Spotlight is a long-form article about one listing, sold as part of the
 * Featured and Pro tiers rather than as a separate SKU. The maker writes it from
 * a fixed template, the owner reviews it, and it is published at
 * `/spotlights/<slug>`.
 *
 * This module is the part both the browser and the server need: the shape of a
 * record, the length gate, and which plans grant the entitlement. Storage lives
 * in `server/utils/spotlights.ts` (table `spotlight`), and the public pages read
 * it through `/api/spotlights`.
 *
 * Editorial rules that the code enforces rather than trusts:
 *
 *  - **The product must already be listed.** `listingSlug` is required, so an
 *    article always has a live internal link to point at.
 *  - **Only the product's own link is dofollow.** Body links render through
 *    `renderMarkdown`, which forces `nofollow`; the card link is written by the
 *    page. That is what keeps an article a description of a product rather than
 *    a link farm.
 *  - **Length is a gate, not a suggestion.** 800–1,500 words, checked on submit
 *    so a draft cannot reach the queue shorter than the published standard.
 */

export type SpotlightStatus = 'pending' | 'approved' | 'rejected'

/** A published article, as the public pages consume it. */
export type Spotlight = {
  slug: string
  /** Slug of the live listing this article belongs to. */
  listingSlug: string
  productName: string
  /** The product's own site. Rendered as the one dofollow link on the page. */
  productUrl: string
  /** One line under the title — the article's angle, not the listing tagline. */
  tagline: string
  /** Markdown body. Rendered by `renderMarkdown`, so raw HTML is escaped. */
  body: string
  author: string
  authorBio?: string
  bestFor?: string
  pricingSummary?: string
  /** ISO date, `YYYY-MM-DD`. Drives sort order and `datePublished`. */
  publishedAt: string
}

/** The queue row: everything the owner needs to decide, including the address. */
export type SpotlightRecord = Spotlight & {
  id: string
  email: string
  status: SpotlightStatus
  reviewNotes: string
  createdAt: number
  updatedAt: number
  reviewedAt: number | null
  /** Null while the article is not live, which is what "unpublished" means. */
  publishedAtMs: number | null
}

/**
 * The draft as both forms hold it: the customer's at `/spotlights/submit` and
 * the owner's at `/admin/spotlights/new`.
 *
 * One shape for two forms on purpose. The fields are what the published
 * standard asks for, so a second, differently-named set would mean two things
 * to validate and two places to forget when the template changes. The only
 * difference the server sees is whether `email` is required — a customer must
 * leave an address for the receipt, an article the owner writes from an email
 * thread may have none.
 */
export type SpotlightDraftInput = {
  listingSlug: string
  productName: string
  productUrl: string
  tagline: string
  body: string
  author: string
  authorBio: string
  bestFor: string
  pricingSummary: string
  email: string
}

export function emptySpotlightDraft(): SpotlightDraftInput {
  return {
    listingSlug: '',
    productName: '',
    productUrl: '',
    tagline: '',
    body: '',
    author: '',
    authorBio: '',
    bestFor: '',
    pricingSummary: '',
    email: '',
  }
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

/** The published standard, in words. Both ends are enforced on submit. */
export const SPOTLIGHT_MIN_WORDS = 800
export const SPOTLIGHT_MAX_WORDS = 1500

/** Field ceilings. Long enough for a real article, short enough to store. */
export const SPOTLIGHT_MAX = {
  productName: 80,
  tagline: 140,
  author: 80,
  authorBio: 400,
  bestFor: 200,
  pricingSummary: 200,
  email: 200,
  body: 20000,
} as const

export function spotlightWords(body: string): number {
  return String(body ?? '').trim().split(/\s+/).filter(Boolean).length
}

/**
 * A URL segment from a product name. ASCII only, because a slug with a percent
 * escape in it is a link that gets mangled the first time it is pasted into a
 * chat client.
 */
export function spotlightSlug(productName: string): string {
  const base = String(productName ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return base || 'spotlight'
}

/** True when a slug is safe to put in a path and cannot collide with a route. */
export function isSpotlightSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(value)
}

/**
 * Reserved segments under /spotlights/. A published article may not take one of
 * these, or it would shadow the index, the guidelines or the badge page.
 */
export const SPOTLIGHT_RESERVED_SLUGS = ['guidelines', 'badge', 'submit', 'new'] as const

export function isReservedSpotlightSlug(value: string): boolean {
  return (SPOTLIGHT_RESERVED_SLUGS as readonly string[]).includes(value)
}
