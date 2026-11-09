/**
 * The only function that turns a SKU into the cents a checkout may charge.
 *
 * Callers pass a kind and an id. They do not pass an amount. List prices live
 * on the pricing table and the Billboard tiers; this module applies the
 * campaign when that kind is in scope and the server clock is still before
 * `endsAt`.
 *
 *   listing   id = free | standard | featured | pro | paid | ad
 *   sidebar   id = "1" | "4"   (weeks; the only slot is sidebar)
 *   billboard id = entry | standard | prime
 *
 * Free listings stay at 0. The retired weekly board slot stays at 0. Entry is
 * in scope, so it takes the same cut as the other Billboard tiers.
 */

import { CAMPAIGN, campaignActive, campaignInScope, centsLabel, saleCents } from '../content/campaign.ts'
import { billboardTier } from '../content/billboard.ts'
import { adPriceCents, planAmountCents } from '../content/pricing.ts'

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
  return billboardTier(id)?.amountCents ?? 0
}

/** Charged cents. Identical to the list price when the campaign is off or out of scope. */
export function effectiveAmountCents(kind: PriceKind, id: string, now = Date.now()): number {
  const list = listAmountCents(kind, id)
  if (!list) return 0
  if (!campaignInScope(kind) || !campaignActive(now)) return list
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
  const active = amountCents > 0 && amountCents < listCents
  return {
    kind,
    id,
    listCents,
    amountCents,
    listLabel,
    priceLabel,
    strikeLabel: active ? listLabel : null,
    active,
  }
}
