/**
 * Launch-pricing clock for the countdown shell and the anchor strikethroughs.
 *
 * Live charges are the list prices in `pricing.ts`. `off` stays 0 so a
 * percentage never rewrites them. Strikes are explicit previous list prices
 * (`anchorCents`), not this rate. Flip `enabled` off to drop the bar, the
 * float, and the strikes. After `endsAt` they drop on their own; the live
 * prices stay. Billboard's floor is not in `scope` and is not struck.
 */
export const CAMPAIGN_SCOPE = ['listing', 'sidebar'] as const
export type CampaignScope = (typeof CAMPAIGN_SCOPE)[number]

export const CAMPAIGN = {
  enabled: true,
  /** Exclusive end: 2026-12-01 06:59 Asia/Shanghai. Countdown shell only. */
  endsAt: '2026-12-01T06:59:00+08:00',
  /**
   * Percent taken off the list price. Cold start keeps this at 0: display
   * price equals the charge. Do not turn a percentage back on to fake a sale.
   */
  off: 0,
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
  const ends = campaignClockMs()
  return ends != null && now < ends
}

/**
 * The only countdown source. A missing or unparseable `endsAt` is not a clock:
 * callers show the deadline sentence and do not paint 00:00:00.
 */
export function campaignClockMs(iso = CAMPAIGN.endsAt): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Nearest whole dollar after `off`, never above the list price.
 * Launch pricing passes `off: 0`, which returns the list price unchanged.
 */
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
