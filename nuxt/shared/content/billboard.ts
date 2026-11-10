/**
 * Billboard — the one price table for the homepage Top 10 and /billboard.
 *
 * The live board is pay-what-you-want from the floor in
 * `shared/utils/billboard-bid.ts` (`BILLBOARD_FLOOR_CENTS`). These three tiers
 * are storage labels for `tierForBid`, not claim prices. Public order is the
 * summed `amount_cents`, not the tier. The floor is not struck as a discount.
 *
 * Set `BLACK_FRIDAY.enabled` to false to hide the promo bar and the strikes
 * immediately. After `endsAt` they hide on their own. Live prices stay.
 */

export type BillboardTierId = 'entry' | 'standard' | 'prime'

export type BillboardTier = {
  id: BillboardTierId
  /** Higher sorts first on the board. Same tier: earlier confirmed payment. */
  rank: number
  amountCents: number
  price: string
  /**
   * Unused by the bid floor. Claim prices read `BILLBOARD_FLOOR_CENTS`.
   * These rows stay as storage labels for `tierForBid`.
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
      en: 'One-time payment. Live the second you pay — including homepage Top 10.',
      zh: '一次付清。付款即上线；含首页 Top 10 展示。',
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
      en: 'One-time payment. Ranks above Entry. Live the second you pay.',
      zh: '一次付清。排序高于入门档；付款即上线。',
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
      en: 'One-time payment. Top priority on the paid board. Live the second you pay.',
      zh: '一次付清。付费板最高优先级；付款即上线。',
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
