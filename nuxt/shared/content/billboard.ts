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
   * Optional minimum. Entry is 0: the campaign discounts every Billboard tier.
   * A positive floor would keep the list price instead of a deeper cut.
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
    floorCents: 0,
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

export {
  BLACK_FRIDAY,
  CAMPAIGN,
  campaignActive,
  campaignDeadlineShanghai,
  centsLabel,
  quoteCents,
  saleCents,
  type PriceQuote,
} from './campaign.ts'
