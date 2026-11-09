/**
 * Billboard — the one price table for the homepage Top 10 and /billboard.
 *
 * Entry $15 / Standard $29 / Prime $49 are one-time. Standard replaces the
 * old board rental ($29/week). Nothing here is a bid ladder, and the list
 * price is never raised so a campaign can draw a strikethrough under it.
 *
 * Set `BLACK_FRIDAY.enabled` to false to hide the promo bar and the strikes
 * immediately. After `endsAt` they hide on their own.
 */

export type BillboardTierId = 'entry' | 'standard' | 'prime'

export type BillboardTier = {
  id: BillboardTierId
  /** Higher sorts first on the board. Same tier: earlier confirmed payment. */
  rank: number
  amountCents: number
  price: string
  /**
   * Campaign sale is not allowed under this many cents. Entry stays at the
   * list price (the locked floor) instead of advertising a deeper cut that
   * has not been approved.
   */
  floorCents: number
  name: { en: string; zh: string }
  blurb: { en: string; zh: string }
}

export const BILLBOARD_TOP_N = 10

export const BILLBOARD_TIERS: readonly BillboardTier[] = [
  {
    id: 'entry',
    rank: 1,
    amountCents: 1500,
    price: '$15',
    floorCents: 1500,
    name: { en: 'Entry', zh: '入门' },
    blurb: {
      en: 'One-time Billboard row. Same board as the homepage Top 10.',
      zh: '一次性 Billboard 一行。和首页 Top 10 是同一块板。',
    },
  },
  {
    id: 'standard',
    rank: 2,
    amountCents: 2900,
    price: '$29',
    floorCents: 0,
    name: { en: 'Standard', zh: '标准' },
    blurb: {
      en: 'Replaces the old $29/week board rental. One payment, not a week.',
      zh: '替代原来的榜单 $29/周。一次付款，不再按周租。',
    },
  },
  {
    id: 'prime',
    rank: 3,
    amountCents: 4900,
    price: '$49',
    floorCents: 0,
    name: { en: 'Prime', zh: '优先' },
    blurb: {
      en: 'Same board, higher tier, so it sorts above Standard and Entry.',
      zh: '同一块板，档位更高，排在标准档和入门档前面。',
    },
  },
] as const

const TIER_IDS = new Set<string>(BILLBOARD_TIERS.map((tier) => tier.id))

export function isBillboardTier(value: string): value is BillboardTierId {
  return TIER_IDS.has(value)
}

export function billboardTier(id: string): BillboardTier | undefined {
  return BILLBOARD_TIERS.find((tier) => tier.id === id)
}

/** Standard is what a legacy `plan: 'ad'` / board $29 charge maps to. */
export function billboardStandardCents(): number {
  return billboardTier('standard')?.amountCents ?? 0
}

export const BLACK_FRIDAY = {
  /** Flip this off to drop the thin bar and every strikethrough at once. */
  enabled: true,
  /** Exclusive end: 2026-12-01 06:59 Asia/Shanghai. */
  endsAt: '2026-12-01T06:59:00+08:00',
  /** Taken off the current list price. The list price itself does not move. */
  off: 0.3,
} as const

export function campaignActive(now = Date.now(), enabled = BLACK_FRIDAY.enabled): boolean {
  if (!enabled) return false
  const ends = Date.parse(BLACK_FRIDAY.endsAt)
  return Number.isFinite(ends) && now < ends
}

/** Nearest whole dollar after `off`, never above the list price. */
export function saleCents(listCents: number, off = BLACK_FRIDAY.off): number {
  if (!Number.isInteger(listCents) || listCents <= 0) return 0
  const dollars = Math.round((listCents * (1 - off)) / 100)
  const cents = dollars * 100
  if (cents <= 0) return listCents
  return Math.min(listCents, cents)
}

export function centsLabel(cents: number): string {
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
 * Strikethrough is always the list price. A floor (Entry) keeps the list
 * price rather than printing a discount under the locked minimum.
 */
export function quoteCents(
  listCents: number,
  now = Date.now(),
  floorCents = 0,
  enabled = BLACK_FRIDAY.enabled,
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
export function campaignDeadlineShanghai(iso = BLACK_FRIDAY.endsAt): string {
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
