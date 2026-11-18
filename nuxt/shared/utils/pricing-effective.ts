/**
 * The only function that turns a SKU into the cents a checkout may charge.
 *
 * `listAmountCents` is the regular price (Boost $10, Standard $19, Featured
 * $39, Pro $69, sidebar $19/week and $76/four weeks). `saleAmountCents` is the
 * explicit campaign price (Boost $4.99, Standard $9, Featured $19, Pro $29,
 * sidebar $9/week and $32/four weeks). While the campaign clock is open the
 * sale price is charged; after `CAMPAIGN.endsAt` the regular price returns
 * automatically.
 *
 *   listing   id = free | boost | standard | featured | pro | paid | ad
 *   sidebar   id = "1" | "4"   (weeks; the only slot is sidebar)
 *   billboard id = floor | entry | standard | prime
 *
 * Billboard is name-your-price: the floor is the minimum and is never struck.
 */

import { campaignActive, campaignInScope, centsLabel } from '../content/campaign.ts'
import { billboardTier } from '../content/billboard.ts'
import {
  adPriceCents,
  adSalePriceCents,
  planAmountCents,
  planSaleAmountCents,
  tiers,
} from '../content/pricing.ts'
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

/** Explicit campaign price, or the regular price when the SKU has no sale. */
export function saleAmountCents(kind: PriceKind, id: string): number {
  if (kind === 'listing') {
    if (id === 'free') return 0
    return planSaleAmountCents(id)
  }
  if (kind === 'sidebar') {
    const weeks = Number(id)
    return adSalePriceCents('sidebar', weeks)
  }
  return listAmountCents(kind, id)
}

/**
 * Regular list price for a strikethrough, or null when no campaign price is
 * lower. This is display-only and never a checkout amount.
 */
export function anchorAmountCents(kind: PriceKind, id: string): number | null {
  const list = listAmountCents(kind, id)
  const sale = saleAmountCents(kind, id)
  return sale > 0 && sale < list ? list : null
}

/** Charged cents: the sale while the clock is open, the regular price after. */
export function effectiveAmountCents(kind: PriceKind, id: string, now = Date.now()): number {
  const list = listAmountCents(kind, id)
  if (!list) return 0
  if (!campaignInScope(kind) || !campaignActive(now)) return list
  const sale = saleAmountCents(kind, id)
  return sale > 0 && sale < list ? sale : list
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
  const active =
    campaignActive(now) &&
    campaignInScope(kind) &&
    amountCents > 0 &&
    listCents > amountCents
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
