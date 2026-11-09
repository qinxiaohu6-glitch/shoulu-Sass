/**
 * Homepage monetization slots.
 *
 * Two jobs, both display-only:
 *
 *  * Category cards show real logos (catalogue and community) and never pad
 *    the thumbnail grid with empty squares. A category with no products
 *    becomes a recruit card instead of a fake listing.
 *  * The old "what you get" block is four bookable spots. Prices are read
 *    from the existing tier and ad tables. A spot shows a product only when
 *    that product is a paid community order or a live ad booking — catalogue
 *    seed rows are not orders, and an empty spot stays a recruit card.
 */

import { adPlans, tiers, type Pair } from '../content/pricing.ts'

export type BrowseTool = {
  slug: string
  category: string
  logo: string
  votes_week: number
}

export type CategoryThumb = {
  slug: string
  logo: string
}

export type CategoryBrowseModel = {
  count: number
  votes: number
  thumbs: CategoryThumb[]
  /** False when this week's votes sum to 0 — the page must not draw a 0% bar. */
  showVoteBar: boolean
  empty: boolean
}

const THUMB_LIMIT = 4

function hasLogo(tool: BrowseTool): boolean {
  return Boolean(String(tool.logo || '').trim())
}

/**
 * One category, as the homepage card should draw it.
 *
 * Catalogue order is kept, then community listings that are not already in
 * that list. A tool with no logo is counted but does not become a blank
 * thumbnail. Hidden slugs are left out of the count, the votes and the logos.
 */
export function categoryBrowseModel(
  categorySlug: string,
  catalog: BrowseTool[],
  submitted: BrowseTool[],
  hidden: string[] = [],
): CategoryBrowseModel {
  const hiddenSet = new Set(hidden)
  const bySlug = new Map<string, BrowseTool>()

  for (const tool of [...catalog, ...submitted]) {
    if (tool.category !== categorySlug) continue
    if (hiddenSet.has(tool.slug)) continue
    const prev = bySlug.get(tool.slug)
    if (!prev) {
      bySlug.set(tool.slug, tool)
      continue
    }
    if (!hasLogo(prev) && hasLogo(tool)) {
      bySlug.set(tool.slug, { ...prev, logo: tool.logo })
    }
  }

  const list = [...bySlug.values()]
  const votes = list.reduce((sum, tool) => sum + (Number(tool.votes_week) || 0), 0)
  const thumbs = list
    .filter(hasLogo)
    .slice(0, THUMB_LIMIT)
    .map((tool) => ({ slug: tool.slug, logo: tool.logo }))

  return {
    count: list.length,
    votes,
    thumbs,
    showVoteBar: votes > 0,
    empty: list.length === 0,
  }
}

/** Where an empty category card sends the two actions. Existing routes only. */
export function emptyCategoryLinks(slug: string): {
  list: { path: string; query: { category: string } }
  sponsor: { path: string }
} {
  return {
    list: { path: '/submit', query: { category: slug } },
    sponsor: { path: '/pricing' },
  }
}

export type OfferOccupant = {
  name: string
  line: string
  logo: string
  /** Tool path (`/tools/…`) or the ad's external URL. */
  href: string
  external: boolean
}

export type OfferListing = {
  slug: string
  name: string
  short: string
  logo: string
  is_paid: boolean
  plan?: string
}

export type OfferAd = {
  name: string
  headline: string
  logo: string
  url: string
} | null

export type HomeOfferSlot = {
  id: 'featured' | 'pro' | 'board' | 'sidebar'
  price: string
  unit: Pair
  name: Pair
  detail: Pair
  href: { path: string; query?: Record<string, string> }
  occupant: OfferOccupant | null
}

function paidListing(listings: OfferListing[], plan: 'featured' | 'pro'): OfferListing | undefined {
  return listings.find((tool) => tool.plan === plan && tool.is_paid && tool.slug && tool.name)
}

function listingOccupant(tool: OfferListing): OfferOccupant {
  return {
    name: tool.name,
    line: tool.short,
    logo: tool.logo,
    href: `/tools/${tool.slug}`,
    external: false,
  }
}

function adOccupant(ad: OfferAd): OfferOccupant | null {
  if (!ad?.name || !ad.url) return null
  return {
    name: ad.name,
    line: ad.headline,
    logo: ad.logo,
    href: ad.url,
    external: true,
  }
}

/**
 * The four spots that replaced the benefit cards.
 *
 * Prices and names come from `tiers` / `adPlans`. Passing a catalogue row
 * that is merely flagged paid does nothing unless `plan` is `featured` or
 * `pro` — seed products do not count as orders.
 */
export function homeOfferSlots(input: {
  listings: OfferListing[]
  board?: OfferAd
  sidebar?: OfferAd
}): HomeOfferSlot[] {
  const featuredTier = tiers.find((tier) => tier.id === 'featured')
  const proTier = tiers.find((tier) => tier.id === 'pro')
  const boardPlan = adPlans.find((plan) => plan.id === 'board')
  const sidebarPlan = adPlans.find((plan) => plan.id === 'sidebar')
  if (!featuredTier || !proTier || !boardPlan || !sidebarPlan) {
    throw new Error('homepage offer slots are missing a row in the pricing tables')
  }

  const featured = paidListing(input.listings, 'featured')
  const pro = paidListing(input.listings, 'pro')

  return [
    {
      id: 'featured',
      price: featuredTier.price,
      unit: featuredTier.unit,
      name: featuredTier.name,
      detail: { zh: '7 天置顶 + 首页卡', en: '7-day pin + homepage card' },
      href: { path: '/submit', query: { plan: 'featured' } },
      occupant: featured ? listingOccupant(featured) : null,
    },
    {
      id: 'pro',
      price: proTier.price,
      unit: proTier.unit,
      name: proTier.name,
      detail: { zh: '分类置顶 90 天', en: 'Category pin for 90 days' },
      href: { path: '/submit', query: { plan: 'pro' } },
      occupant: pro ? listingOccupant(pro) : null,
    },
    {
      id: 'board',
      price: boardPlan.price,
      unit: boardPlan.unit,
      name: boardPlan.name,
      detail: boardPlan.where,
      href: { path: '/book-ad', query: { slot: 'board', weeks: '1' } },
      occupant: adOccupant(input.board ?? null),
    },
    {
      id: 'sidebar',
      price: sidebarPlan.price,
      unit: sidebarPlan.unit,
      name: sidebarPlan.name,
      detail: sidebarPlan.where,
      href: { path: '/book-ad', query: { slot: 'sidebar', weeks: '1' } },
      occupant: adOccupant(input.sidebar ?? null),
    },
  ]
}
