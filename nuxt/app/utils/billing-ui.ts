/**
 * Source `routes/settings/-billing-shared.tsx`, minus the JSX.
 *
 * Same shapes and the same string tables; `statusLabel` keeps the source's
 * trick of reusing the `tab_*` labels for statuses and falling back to the raw
 * value when a status has no translation.
 */
export type Subscription = {
  id: string
  subscriptionNo: string
  status: string
  paymentProvider: string
  productId?: string | null
  planName?: string | null
  productName?: string | null
  /** Sponsor ad name when this subscription is a directory seat. */
  resourceLabel?: string | null
  interval?: string | null
  intervalCount?: number | null
  amount?: number | null
  currency?: string | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  canceledAt?: string | null
  canceledEndAt?: string | null
  canceledReason?: string | null
  createdAt?: string | null
}

export const TABS = [
  'all',
  'active',
  'trialing',
  'paused',
  'expired',
  'pending_cancel',
  'canceled',
] as const
export type Tab = (typeof TABS)[number]

export const PAGE_SIZE = 20

export function formatAmount(amount: number, currency: string) {
  const normalized = (currency || 'usd').toUpperCase()
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: normalized,
  }).format(amount / 100)
}

export function statusVariant(
  status?: string | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status || '').toLowerCase()
  if (s === 'active' || s === 'trialing') return 'default'
  if (s === 'canceled' || s === 'expired') return 'destructive'
  return 'secondary'
}

export function isCancellable(status?: string | null) {
  const s = (status || '').toLowerCase()
  return s === 'active' || s === 'trialing'
}

/** Localize subscription status; reuse the tab_* labels already in messages. */
export function statusLabel(
  t: (key: string, params?: Record<string, string | number>) => string,
  status?: string | null,
) {
  const s = (status || '').toLowerCase()
  if (!s) return '—'
  const key = `settings.billing.tab_${s}`
  const label = t(key)
  return label === key ? status || s : label
}

/** Localize a billing interval, e.g. "1 month" / "1 个月". */
export function formatInterval(
  t: (key: string, params?: Record<string, string | number>) => string,
  interval?: string | null,
  intervalCount?: number | null,
) {
  if (!interval) return ''
  const unit = interval.toLowerCase().replace(/_/g, '-')
  const count = intervalCount && intervalCount > 0 ? intervalCount : 1
  const n = String(count)
  if (unit === 'one-time') return t('settings.billing.interval_one_time')
  const map: Record<string, [string, string]> = {
    day: ['settings.billing.interval_day', 'settings.billing.interval_days'],
    week: ['settings.billing.interval_week', 'settings.billing.interval_weeks'],
    month: ['settings.billing.interval_month', 'settings.billing.interval_months'],
    year: ['settings.billing.interval_year', 'settings.billing.interval_years'],
  }
  const pair = map[unit]
  if (!pair) return count > 1 ? `${count} ${interval}` : interval
  return t(count === 1 ? pair[0] : pair[1], { count: n })
}

export function isSponsorSubscription(sub: { productId?: string | null }) {
  return Boolean(sub.productId?.startsWith('directory_sponsor_'))
}

export function subscriptionTitle(sub: Subscription) {
  const plan = sub.planName || sub.productName || '—'
  if (sub.resourceLabel) return `${plan} · ${sub.resourceLabel}`
  return plan
}
