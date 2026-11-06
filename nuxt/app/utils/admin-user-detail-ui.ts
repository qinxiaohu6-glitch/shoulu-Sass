/**
 * Shapes and small helpers shared by the user-detail cards.
 *
 * Source: `shipany-dir/src/routes/admin/-user-timeline.tsx`,
 * `-user-orders.tsx` and `-user-credits.tsx`. The row interfaces are the
 * source's field for field, because the endpoints behind them answer with the
 * source's vocabulary (see `server/api/admin/orders/list.get.ts`).
 */

export interface TimelineDetail {
  [key: string]: string | number | boolean | null
}

/**
 * The detail endpoint's payload — the source's `UserDetail`.
 *
 * `server/utils/admin-users.ts` declares the same shape from the answering
 * side; this is the reading side of the wire, so the two are kept in step by
 * hand rather than by importing across the app/server boundary.
 */
export interface AdminUserDetail {
  user: {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    createdAt: string
    utmSource: string
    utmMedium: string
    utmCampaign: string
    utmTerm: string
    utmContent: string
    referrer: string
    ip: string
    country: string
    locale: string
  }
  roles: { roleId: string; roleName: string; roleTitle: string }[]
  stats: {
    creditBalance: number
    creditsGranted: number
    creditsConsumed: number
    orderCount: number
    lastOrderAt: string | null
    paidOrderCount: number
    paidAmounts: { currency: string; amount: number }[]
  }
}

export interface TimelineEvent {
  key: string
  at: string
  kind: string
  detail: TimelineDetail
  ref?: { type: 'order' | 'subscription' | 'credit' | 'ticket'; id: string }
  href?: string
}

export interface TimelinePage {
  items: TimelineEvent[]
  nextCursor: string | null
}

export const ORDERS_PAGE_SIZE = 10
export const CREDITS_PAGE_SIZE = 10

/** Source `ORDER_STATUSES` — the status filter's options, in the source's order. */
export const ORDER_STATUSES = [
  'pending',
  'created',
  'paid',
  'failed',
  'refunding',
  'refunded',
  'deleted',
  // This build's `payment_order` also stores `cancelled` (a checkout the buyer
  // abandoned). It is offered as a filter so those rows are reachable.
  'cancelled',
] as const

/** Stored `paymentType` → label key (`settings.payments.tab_*`). */
export const ORDER_TYPES = [
  ['one-time', 'one_time'],
  ['subscription', 'subscription'],
  ['renew', 'renew'],
] as const

export const CREDIT_TYPES = ['grant', 'consume'] as const
export const CREDIT_STATUSES = ['active', 'expired', 'deleted'] as const

export interface AdminOrderRow {
  id: string
  orderNo: string
  status: string
  amount: number
  currency: string
  paymentType: string | null
  paymentProvider: string
  productName: string | null
  createdAt: string
  paidAt: string | null
}

export interface AdminCreditRow {
  id: string
  transactionNo: string
  transactionType: string
  transactionScene: string | null
  credits: number
  remainingCredits: number
  description: string | null
  expiresAt: string | null
  status: string
  createdAt: string
}

/** Source `formatAmount` — minor units to a currency string. */
export function formatOrderAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount / 100)
}

export function orderStatusVariant(status: string) {
  if (status === 'paid') return 'default' as const
  if (status === 'failed') return 'destructive' as const
  return 'secondary' as const
}
