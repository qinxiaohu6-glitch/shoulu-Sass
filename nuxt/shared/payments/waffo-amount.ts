/**
 * The number on the page, the order row, and the Waffo product have to be the
 * same number. `priceSnapshot` is sent as well, but Waffo drops it when the
 * call is not authenticated as the merchant, and a dropped snapshot charges
 * the product's stored price. One stored price cannot be $9, $32, $29 and
 * $116 at the same time, so each charge gets its own product.
 *
 * Checkout refuses to open a session when the stored price differs. The
 * webhook refuses to publish when the charged goods price differs. A small
 * excess can still be tax; a second copy of the catalogue price cannot.
 */

import { adPlans, adPriceCents, adSalePriceCents, tiers } from '../content/pricing.ts'

/** Above this, an extra charge is a wrong price, not tax. 30% covers VAT. */
export const TAX_CEILING_RATIO = 0.3

const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW',
  'PYG', 'RWF', 'UGX', 'UYU', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

const LISTING_PLANS = ['boost', 'standard', 'featured', 'pro'] as const
const AD_SLOTS = ['board', 'sidebar', 'app'] as const

export interface WaffoChargeProduct {
  /** `plan:cents`, the key in `NUXT_WAFFO_PRODUCT_IDS`. Ads all use plan `ad`. */
  key: string
  plan: string
  amountCents: number
  /** Waffo display amount, e.g. `4.99`. */
  amount: string
  name: string
  description: string
}

export function toAmountString(cents: number, currency: string): string {
  if (ZERO_DECIMAL.has(currency.toUpperCase())) return String(Math.round(cents))
  return (cents / 100).toFixed(2)
}

export function fromAmountString(value: string | undefined, currency: string): number {
  if (!value) return 0
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(parsed)) return 0
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(parsed) : Math.round(parsed * 100)
}

export function amountsEqual(catalogue: string | null | undefined, cents: number, currency: string): boolean {
  if (catalogue == null || String(catalogue).trim() === '') return false
  return fromAmountString(catalogue, currency) === cents
}

export function productKey(plan: string, amountCents: number): string {
  return `${plan}:${amountCents}`
}

/**
 * Prefer the product minted for this exact charge. A plan-level id is only a
 * candidate: the caller still has to read its price and refuse when it differs.
 */
export function selectProductId(
  productIds: Record<string, string>,
  plan: string,
  amountCents: number,
  fallback = '',
): string {
  const exact = productIds[productKey(plan, amountCents)]?.trim()
  if (exact) return exact
  return (productIds[plan] || productIds['*'] || fallback || '').trim()
}

/**
 * True only when every map entry for this product names the same amount.
 * A plan-level key (`boost`) does not name an amount, so the product is not
 * safe to reprice: the live site still charges other amounts through it.
 */
export function productLockedToAmount(
  productIds: Record<string, string>,
  productId: string,
  amountCents: number,
): boolean {
  if (!productId) return false
  const keys = Object.entries(productIds)
    .filter(([, id]) => id === productId)
    .map(([key]) => key)
  if (keys.length === 0) return false
  return keys.every((key) => {
    const match = /:(\d+)$/.exec(key)
    return match !== null && Number(match[1]) === amountCents
  })
}

/**
 * The hosted checkout bootstrap. `createSession` does not echo the locked
 * price; this payload does. Missing fields mean "do not redirect".
 */
export function sessionQuote(payload: unknown): { amount: string | null; productId: string | null } {
  const session = (payload as {
    sessionResult?: { data?: { checkoutSession?: { priceInfo?: { amount?: string }; productId?: string } } }
  } | null)?.sessionResult?.data?.checkoutSession
  const amount = session?.priceInfo?.amount
  const productId = session?.productId
  return {
    amount: amount == null || String(amount).trim() === '' ? null : String(amount),
    productId: productId == null || String(productId).trim() === '' ? null : String(productId),
  }
}

/** Read a USD (or other) amount out of either the REST or the GraphQL price shape. */
export function catalogueAmount(prices: unknown, currency = 'USD'): string | null {
  if (!prices) return null
  const code = currency.toUpperCase()
  if (Array.isArray(prices)) {
    const row = prices.find((entry) => String(entry?.currency || '').toUpperCase() === code) as
      | { priceInfo?: { amount?: string }; amount?: string }
      | undefined
    const amount = row?.priceInfo?.amount ?? row?.amount
    return amount == null || String(amount).trim() === '' ? null : String(amount)
  }
  if (typeof prices === 'object') {
    const record = prices as Record<string, { amount?: string }>
    const direct = record[code] ?? record[code.toLowerCase()]
    if (direct?.amount != null && String(direct.amount).trim() !== '') return String(direct.amount)
  }
  return null
}

export function taxCeilingCents(orderCents: number): number {
  if (orderCents <= 0) return 0
  return Math.floor(orderCents * TAX_CEILING_RATIO)
}

export type ChargeVerdict =
  | { ok: true; note?: string }
  | { ok: false; reason: 'shortfall' | 'currency' | 'goods_mismatch' | 'excess' }

/**
 * Decide whether a captured charge is the order we quoted.
 *
 * `goodsCents` is the pre-tax price (`listPrice.subtotal`). When Waffo sends
 * it, that number has to equal the order. The card total may sit above it by
 * tax, up to {@link TAX_CEILING_RATIO}. Anything further above is the
 * catalogue price leaking through and must not publish the purchase.
 */
export function classifyCharge(input: {
  orderCents: number
  chargedCents: number
  currency: string
  orderCurrency: string
  goodsCents: number | null
}): ChargeVerdict {
  if (input.currency.toLowerCase() !== input.orderCurrency.toLowerCase()) {
    return { ok: false, reason: 'currency' }
  }
  const goods = input.goodsCents
  if (goods != null && goods !== input.orderCents) {
    return { ok: false, reason: 'goods_mismatch' }
  }
  if (input.chargedCents < input.orderCents) return { ok: false, reason: 'shortfall' }
  if (input.chargedCents === input.orderCents) return { ok: true }
  const excess = input.chargedCents - input.orderCents
  if (excess > taxCeilingCents(input.orderCents)) return { ok: false, reason: 'excess' }
  return {
    ok: true,
    note: `tax: charged ${input.chargedCents}, listing ${input.orderCents}`,
  }
}

/**
 * Every amount the server can charge on a new checkout, campaign price and
 * regular price both included. Derived from the pricing table so a price edit
 * shows up here without a second list.
 *
 * Billboard bids are not here: new bids are closed and the amount is not a
 * fixed price. Already-paid rows settle through the webhook, not a new product.
 */
export function waffoChargeProducts(): WaffoChargeProduct[] {
  const out: WaffoChargeProduct[] = []
  const seen = new Set<string>()

  const add = (plan: string, amountCents: number, label: string, description: string) => {
    if (!Number.isInteger(amountCents) || amountCents <= 0) return
    const key = productKey(plan, amountCents)
    if (seen.has(key)) return
    seen.add(key)
    const amount = toAmountString(amountCents, 'usd')
    out.push({
      key,
      plan,
      amountCents,
      amount,
      name: `dirtool — ${label} ${amount} USD`,
      description,
    })
  }

  for (const id of LISTING_PLANS) {
    const tier = tiers.find((entry) => entry.id === id)
    if (!tier) continue
    const amounts = new Set<number>([tier.amountCents])
    if (tier.saleCents && tier.saleCents > 0) amounts.add(tier.saleCents)
    for (const cents of amounts) {
      const amount = toAmountString(cents, 'usd')
      add(
        id,
        cents,
        tier.name.en,
        `${tier.name.en} listing on dirtool.com. One-time charge of ${amount} USD.`,
      )
    }
  }

  for (const slot of AD_SLOTS) {
    const plan = adPlans.find((entry) => entry.id === slot)
    if (!plan) continue
    for (const weeks of [1, 4] as const) {
      const amounts = new Set<number>([adPriceCents(slot, weeks), adSalePriceCents(slot, weeks)])
      const span = weeks === 1 ? '1 week' : '4 weeks'
      for (const cents of amounts) {
        const amount = toAmountString(cents, 'usd')
        add(
          'ad',
          cents,
          `${plan.name.en} ${span}`,
          `${plan.name.en}, ${span}, on dirtool.com. One-time charge of ${amount} USD.`,
        )
      }
    }
  }

  return out
}
