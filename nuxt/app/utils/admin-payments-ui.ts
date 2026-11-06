/**
 * Source `routes/admin/-payments-edit-dialog.tsx` (`Order`) plus the page's
 * constants. `formatOrderAmount` is shared with the user-detail cards.
 */

export interface AdminOrder {
  id: string
  orderNo: string
  userId: string
  userEmail: string | null
  status: string
  amount: number
  currency: string
  paymentType: string | null
  paymentProvider: string
  productId: string | null
  productName: string | null
  description: string | null
  createdAt: string
  paidAt: string | null
  paymentAmount: number | null
  creditsAmount: number | null
  subscriptionNo: string | null
  refundAmount: number | null
  refundedAt: string | null
  userName: string | null
  userImage: string | null
  userAccountEmail: string | null
}

export const PAYMENTS_PAGE_SIZE = 20

export const PAYMENT_TABS = ['all', 'subscription', 'one_time'] as const
export type PaymentTab = (typeof PAYMENT_TABS)[number]

/** The status filter's options, in the source's order. */
export const PAYMENT_STATUSES = [
  'pending',
  'created',
  'paid',
  'failed',
  'refunded',
  'deleted',
  'refunding',
  // This build's `payment_order` also stores `cancelled` (an abandoned
  // checkout), so it is reachable from the filter too.
  'cancelled',
] as const

export function paymentStatusVariant(status: string) {
  if (status === 'paid') return 'default' as const
  if (status === 'failed') return 'destructive' as const
  if (status === 'refunded' || status === 'refunding') return 'outline' as const
  return 'secondary' as const
}
