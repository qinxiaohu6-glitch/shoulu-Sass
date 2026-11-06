/**
 * Source `routes/admin/subscriptions.tsx` — the row shape and the page's
 * constants. The interface is the source's `Subscription`, field for field.
 */

export interface AdminSubscription {
  id: string
  subscriptionNo: string
  userId: string
  userEmail: string | null
  userName: string | null
  userImage: string | null
  userAccountEmail: string | null
  status: string
  amount: number | null
  currency: string | null
  interval: string | null
  paymentProvider: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  description: string | null
  createdAt: string
}

export const SUBSCRIPTIONS_PAGE_SIZE = 20

export const SUBSCRIPTION_TABS = ['all', 'month', 'year'] as const
export type SubscriptionTab = (typeof SUBSCRIPTION_TABS)[number]

/** The source's `formatAmount`: a null amount is the "—" case, not zero. */
export function formatSubscriptionAmount(amount: number | null, currency: string | null) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount / 100)
}

export function subscriptionStatusVariant(status: string) {
  if (status === 'active' || status === 'trialing') return 'default' as const
  if (status === 'canceled' || status === 'expired') return 'destructive' as const
  return 'secondary' as const
}
