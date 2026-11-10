/**
 * The only function that turns a SKU into the cents a checkout may charge.
 *
 * Callers pass a kind and an id. They do not pass an amount. List prices live
 * on the pricing table. With launch pricing, that list price is the charge.
 * Anchors are display-only and only while the campaign clock is still open.
 *
 *   listing   id = free | standard | featured | pro | paid | ad
 *   sidebar   id = "1" | "4"   (weeks; the only slot is sidebar)
 *   billboard id = floor | entry | standard | prime
 *
 * Free listings stay at 0. The retired weekly board slot stays at 0.
 * `CAMPAIGN.off` is 0, so a percentage never changes a charge. Strikes, when
 * the clock is still open, come from explicit anchors on the pricing rows.
 * Billboard `floor` is the bid minimum and is never struck.
 */

import { CAMPAIGN, campaignActive, campaignInScope, centsLabel, saleCents } from '../content/campaign.ts'
import { billboardTier } from '../content/billboard.ts'
import { adPlans, adPriceCents, planAmountCents, tiers } from '../content/pricing.ts'
import { BILLBOARD_FLOOR_CENTS } from './billboard-bid.ts'

export type PriceKind = 'listing' | 'sidebar' | 'billboard'

export function listAmountCents(kind: PriceKind, id: string): number {
  if (kind === 'listing') {
    if (id === 'free') return 0
    return planAmountCents(id)
  }
  if (kind === 'sidebar') {
    const weeks = Number(id)
    return adPriceCents('sidebar', weeks)
  }
  if (id === 'floor') return BILLBOARD_FLOOR_CENTS
  return billboardTier(id)?.amountCents ?? 0
}

/**
 * Previous list price for a strikethrough. Null when this SKU has no anchor.
 * Never a checkout amount.
 */
export function anchorAmountCents(kind: PriceKind, id: string): number | null {
  if (kind === 'listing') {
    const slug = id === 'paid' ? 'featured' : id
    const tier = tiers.find((row) => row.id === slug)
    const anchor = tier?.anchorCents
    if (!tier || anchor == null || anchor <= tier.amountCents) return null
    return anchor
  }
  if (kind === 'sidebar' && id === '1') {
    const plan = adPlans.find((row) => row.id === 'sidebar')
    const anchor = plan?.anchorWeeklyCents
    if (!plan || anchor == null || anchor <= plan.weeklyCents) return null
    return anchor
  }
  return null
}

/**
 * Charged cents. With `CAMPAIGN.off` at 0 this is the list price.
 * A positive `off` would still be ignored for Billboard, which is out of scope.
 */
export function effectiveAmountCents(kind: PriceKind, id: string, now = Date.now()): number {
  const list = listAmountCents(kind, id)
  if (!list) return 0
  if (!(CAMPAIGN.off > 0) || !campaignInScope(kind) || !campaignActive(now)) return list
  return saleCents(list, CAMPAIGN.off)
}

export type EffectiveQuote = {
  kind: PriceKind
  id: string
  listCents: number
  amountCents: number
  listLabel: string
  priceLabel: string
  strikeLabel: string | null
  active: boolean
}

export function effectiveQuote(kind: PriceKind, id: string, now = Date.now()): EffectiveQuote {
  const listCents = listAmountCents(kind, id)
  const amountCents = effectiveAmountCents(kind, id, now)
  const listLabel = centsLabel(listCents)
  const priceLabel = centsLabel(amountCents)
  const anchor = anchorAmountCents(kind, id)
  const active = campaignActive(now) && anchor != null && amountCents > 0 && anchor > amountCents
  return {
    kind,
    id,
    listCents,
    amountCents,
    listLabel,
    priceLabel,
    strikeLabel: active && anchor != null ? centsLabel(anchor) : null,
    active,
  }
}
