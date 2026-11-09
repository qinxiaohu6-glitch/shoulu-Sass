/**
 * One campaign clock for every strikethrough and every checkout.
 *
 * `scope` is the set of SKUs that actually charge the sale price. A card
 * outside this set must not draw a strikethrough. Flip `enabled` off to drop
 * the bar, the float, and every sale at once. After `endsAt` they drop on
 * their own, using the server clock.
 */

/**
 * Billboard is pay-what-you-want from $15. The campaign does not discount
 * that floor. Launch listings and the sidebar still take the sale price.
 * The homepage promo bar may still *display* Prime $49 → $34 as a narrative
 * strikethrough; that figure is not a Billboard charge.
 */
export const CAMPAIGN_SCOPE = ['listing', 'sidebar'] as const
export type CampaignScope = (typeof CAMPAIGN_SCOPE)[number]

export const CAMPAIGN = {
  enabled: true,
  /** Exclusive end: 2026-12-01 06:59 Asia/Shanghai. */
  endsAt: '2026-12-01T06:59:00+08:00',
  /** Taken off the current list price. The list price itself does not move. */
  off: 0.3,
  scope: CAMPAIGN_SCOPE,
} as const

/** Same object the older Billboard module exported. */
export const BLACK_FRIDAY = {
  enabled: CAMPAIGN.enabled,
  endsAt: CAMPAIGN.endsAt,
  off: CAMPAIGN.off,
} as const

export function campaignInScope(kind: string): kind is CampaignScope {
  return (CAMPAIGN_SCOPE as readonly string[]).includes(kind)
}

export function campaignActive(now = Date.now(), enabled: boolean = CAMPAIGN.enabled): boolean {
  if (!enabled) return false
  const ends = Date.parse(CAMPAIGN.endsAt)
  return Number.isFinite(ends) && now < ends
}

/** Nearest whole dollar after `off`, never above the list price. */
export function saleCents(listCents: number, off = CAMPAIGN.off): number {
  if (!Number.isInteger(listCents) || listCents <= 0) return 0
  const dollars = Math.round((listCents * (1 - off)) / 100)
  const cents = dollars * 100
  if (cents <= 0) return listCents
  return Math.min(listCents, cents)
}

export function centsLabel(cents: number): string {
  if (!Number.isFinite(cents)) return ''
  if (cents % 100 === 0) return `$${cents / 100}`
  return `$${(cents / 100).toFixed(2)}`
}

export type PriceQuote = {
  listCents: number
  listLabel: string
  /** Current price. The list price when the campaign is off or the floor holds. */
  priceLabel: string
  /** Struck-through list label. Null when nothing is discounted. */
  strikeLabel: string | null
  active: boolean
}

/**
 * Strikethrough is always the list price. A positive floor keeps the list
 * price rather than printing a discount under that minimum. Checkout does not
 * use this helper — it uses `effectiveAmountCents`, which already decided the
 * floor for each SKU.
 */
export function quoteCents(
  listCents: number,
  now = Date.now(),
  floorCents = 0,
  enabled: boolean = CAMPAIGN.enabled,
): PriceQuote {
  const listLabel = centsLabel(listCents)
  const active = campaignActive(now, enabled)
  if (!active || listCents <= 0) {
    return { listCents, listLabel, priceLabel: listLabel, strikeLabel: null, active: false }
  }
  let sale = saleCents(listCents)
  if (floorCents > 0 && sale < floorCents) sale = listCents
  if (sale >= listCents) {
    return { listCents, listLabel, priceLabel: listLabel, strikeLabel: null, active: true }
  }
  return {
    listCents,
    listLabel,
    priceLabel: centsLabel(sale),
    strikeLabel: listLabel,
    active: true,
  }
}

/** Shanghai wall time of the campaign end, derived from `endsAt` only. */
export function campaignDeadlineShanghai(iso = CAMPAIGN.endsAt): string {
  const date = new Date(iso)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

export function campaignSnapshot(now = Date.now()) {
  return {
    active: campaignActive(now),
    ends_at: CAMPAIGN.endsAt,
    off: CAMPAIGN.off,
    scope: [...CAMPAIGN.scope],
  }
}
