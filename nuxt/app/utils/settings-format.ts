/**
 * Source `routes/settings/-dashboard-widgets.tsx` — `formatAmount` / `formatDate`.
 *
 * Shared by the overview, billing and payments pages, which is why they live
 * here rather than in one page's component.
 */

/** Cents in, a localized currency string out — `amount / 100`, as the source. */
export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
  }).format(amount / 100)
}

export function formatDate(value?: string | number | null) {
  if (!value) return ''
  // The source stores ISO strings; this build stores Unix seconds in some
  // tables, so both shapes are accepted rather than printing "Invalid Date".
  const d = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}
