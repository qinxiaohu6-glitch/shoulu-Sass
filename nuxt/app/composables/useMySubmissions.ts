/**
 * The account's own submissions, shared by the overview and the list page.
 *
 * Both pages need the same list and both render it during SSR, so the fetch
 * goes through `useRequestFetch` — on the server that is the variant that
 * forwards the incoming cookie, and without it every request would look
 * signed-out and the pages would render empty.
 */

import { planAmountCents } from '~~/shared/content/pricing'

export type MySubmission = {
  id: string
  slug: string
  name: string
  url: string
  domain: string
  short: string
  category: string
  plan: string
  slot: string
  status: 'pending' | 'approved' | 'rejected'
  awaiting_payment: boolean
  /** Unix seconds; `null` until the payment settles (the webhook publishes automatically). */
  paid_at: number | null
  /** Whatever was recorded when the payment settled; empty for free listings. */
  payment_ref: string
  /** Owner-only: the settings list draws this as the row's 40px thumb. */
  logo: string
  created_at: number
  updated_at: number
}

/**
 * The four states a submitter can actually be in.
 *
 * Derived once so the overview card and the table cannot disagree about what a
 * row means. They still word it differently — the live build says "In review" on
 * the card and "Pending review" in the table — but that is presentation, and it
 * is applied on top of this.
 */
export type SubmissionState = 'live' | 'rejected' | 'awaiting' | 'pending'

/**
 * `awaiting_payment` wins over `pending`.
 *
 * A paid tier that has not been paid is not in the review queue at all:
 * `reviewSubmission` refuses to approve it, so nothing will ever happen until the
 * money arrives. Calling that "in review" would leave the submitter waiting for a
 * decision that cannot be made — the single most misleading label this page could
 * show, and the reason this helper exists.
 */
export function stateOf(
  s: Pick<MySubmission, 'status' | 'awaiting_payment' | 'paid_at'>,
): SubmissionState {
  if (s.status === 'rejected') return 'rejected'
  if (s.status === 'approved') return 'live'
  if (s.awaiting_payment && !s.paid_at) return 'awaiting'
  return 'pending'
}

export function useMySubmissions() {
  const requestFetch = useRequestFetch()

  const { data, refresh, status } = useAsyncData(
    'my-submissions',
    () => requestFetch<{ ok: boolean; items: MySubmission[] }>('/api/my/submissions'),
    { default: () => ({ ok: true, items: [] as MySubmission[] }) },
  )

  return {
    items: computed<MySubmission[]>(() => data.value?.items ?? []),
    refresh,
    status,
  }
}

/** Plan slug → the label the pricing page uses. */
export function planLabelOf(plan: string, isZh: boolean): string {
  if (plan === 'pro') return isZh ? '专业版' : 'Pro'
  if (plan === 'featured') return 'Featured'
  if (plan === 'standard' || plan === 'ad') return 'Standard'
  return isZh ? '免费版' : 'Free'
}

/**
 * What each tier costs, straight from the pricing page.
 *
 * The numbers now live in `shared/content/pricing.ts`, next to the copy that
 * prints them, because checkout on the server needs the same table and a
 * second copy is how a $39 page starts charging $19. This is only the
 * formatting side.
 */
export function planCentsOf(plan: string): number {
  return planAmountCents(plan)
}

export function planPriceOf(plan: string): string {
  return `$${planCentsOf(plan) / 100}`
}

/** `YYYY-MM-DD` in local time, the way the old dashboard printed it. */
export function dayOf(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The admin queue carries the submitter's address and the reviewer's notes. */
export type AdminSubmission = MySubmission & {
  email: string
  maker: string
  tags: string[]
  paid_at: number | null
  notes: string
  logo: string
  long_desc: string
}
