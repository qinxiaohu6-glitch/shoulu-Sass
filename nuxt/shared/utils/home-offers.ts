/**
 * Homepage monetization slots.
 *
 * Two jobs, both display-only:
 *
 *  * Category cards show real logos (catalogue and community) and never pad
 *    the thumbnail grid with empty squares. A category with no products
 *    becomes a recruit card instead of a fake listing.
 *  * The bookable spots are the two weekly ads. Prices are read from the ad
 *    table. A spot shows a live ad, and an empty spot stays a recruit card.
 */

import { centsLabel } from '../content/campaign.ts'
import { adPlans, type Pair } from '../content/pricing.ts'
import { effectiveQuote } from './pricing-effective.ts'

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
  id: 'board' | 'sidebar'
  /** Paid placements are labeled. The weekly vote board is a different list. */
  flag: 'BOARD' | 'SIDEBAR'
  price: string
  unit: Pair
  name: Pair
  detail: Pair
  href: { path: string; query?: Record<string, string>; hash?: string }
  occupant: OfferOccupant | null
}

/**
 * Empty-slot subtitle. Name and price come from the pricing tables.
 * There is no inventory count here — a "spots left" line waits until a
 * real remaining-capacity number exists.
 */
export function offerSpotLine(slot: Pick<HomeOfferSlot, 'name' | 'price' | 'unit'>, locale: 'zh' | 'en'): string {
  if (slot.price.startsWith('from ')) {
    const amount = slot.price.slice('from '.length)
    if (locale === 'zh') return `${slot.name.zh} 从 ${amount} 起 ${slot.unit.zh}`
    return `${slot.name.en} from ${amount} ${slot.unit.en}`
  }
  const unit = slot.unit[locale].replace(/\s+/g, '')
  const name = slot.name[locale]
  if (unit.startsWith('/')) return `${name} ${slot.price}${unit}`
  return `${name} ${slot.price} ${unit}`
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
 * The two weekly ads.
 *
 * Names come from `adPlans`. The sidebar price comes from `effectiveQuote`.
 * The launch-board ad uses its weekly price and is not discounted.
 */
export function homeOfferSlots(input: {
  listings?: OfferListing[]
  /** A live launch-board ad, or a Billboard placement already paid for. */
  billboard?: OfferAd
  sidebar?: OfferAd
}): HomeOfferSlot[] {
  const boardPlan = adPlans.find((plan) => plan.id === 'board')
  const sidebarPlan = adPlans.find((plan) => plan.id === 'sidebar')
  if (!boardPlan || !sidebarPlan) {
    throw new Error('homepage offer slots are missing a row in the pricing tables')
  }
  const boardPrice = centsLabel(boardPlan.weeklyCents)
  const sidebarPrice = effectiveQuote('sidebar', '1').priceLabel

  return [
    {
      id: 'board',
      flag: 'BOARD',
      price: boardPrice,
      unit: boardPlan.unit,
      name: boardPlan.name,
      detail: boardPlan.where,
      href: { path: '/book-ad', query: { slot: 'board', weeks: '1' } },
      occupant: adOccupant(input.billboard ?? null),
    },
    {
      id: 'sidebar',
      flag: 'SIDEBAR',
      price: sidebarPrice,
      unit: sidebarPlan.unit,
      name: sidebarPlan.name,
      detail: sidebarPlan.where,
      href: { path: '/book-ad', query: { slot: 'sidebar', weeks: '1' } },
      occupant: adOccupant(input.sidebar ?? null),
    },
  ]
}
