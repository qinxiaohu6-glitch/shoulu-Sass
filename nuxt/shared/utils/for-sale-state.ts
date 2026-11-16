/**
 * For-sale state machine.
 *
 * Public only when status is active AND the fee was paid AND review passed.
 * Review checks ownership and spam. It does not verify income, and it does
 * not substitute a revenue figure for a missing profit.
 *
 * Unlist (sold or withdrawn) removes the row from the public list. Listing
 * again requires another payment. Changing the asking price does not.
 */

export type ForSaleStatus =
  | 'draft'
  | 'paid_pending_review'
  | 'active'
  | 'sold'
  | 'withdrawn'
  | 'rejected'

export interface ForSaleCycle {
  status: ForSaleStatus
  paidAt: number | null
  reviewedAt: number | null
}

export interface PublicForSaleCard {
  id: string
  product_slug: string
  product_name: string
  asking_cents: number
  revenue: string
  profit: string
  team: string
  stack: string
  interested: number
}

const STATUSES: readonly ForSaleStatus[] = [
  'draft',
  'paid_pending_review',
  'active',
  'sold',
  'withdrawn',
  'rejected',
]

export function isForSaleStatus(value: string): value is ForSaleStatus {
  return (STATUSES as readonly string[]).includes(value)
}

/** The only public predicate. Both timestamps are required. */
export function isPublicForSale(row: ForSaleCycle): boolean {
  return row.status === 'active' && row.paidAt != null && row.reviewedAt != null
}

/** A new $9.90 is due for a draft, or after the seller has unlisted. */
export function canStartCheckout(row: ForSaleCycle): boolean {
  return row.status === 'draft' || row.status === 'sold' || row.status === 'withdrawn'
}

/**
 * Payment marks the row paid and waiting for review. It never sets active.
 * Returns null when this cycle is already paid (active or pending review).
 */
export function markPaid(row: ForSaleCycle, now: number): ForSaleCycle | null {
  if (!canStartCheckout(row)) return null
  return { status: 'paid_pending_review', paidAt: now, reviewedAt: null }
}

/**
 * Review. Refuses a row that has not been paid. Passing review is what
 * makes the row active; the caller still has to check ownership and spam.
 */
export function markReviewed(row: ForSaleCycle, approved: boolean, now: number): ForSaleCycle | null {
  if (row.status !== 'paid_pending_review' || row.paidAt == null) return null
  if (!approved) return { status: 'rejected', paidAt: row.paidAt, reviewedAt: null }
  return { status: 'active', paidAt: row.paidAt, reviewedAt: now }
}

export function unlistForSale(row: ForSaleCycle, reason: 'sold' | 'withdrawn'): ForSaleCycle | null {
  if (row.status !== 'active' && row.status !== 'paid_pending_review') return null
  return { status: reason, paidAt: row.paidAt, reviewedAt: row.reviewedAt }
}

/** After unlist, the next public cycle starts unpaid. */
export function relistForSale(row: ForSaleCycle): ForSaleCycle | null {
  if (row.status !== 'sold' && row.status !== 'withdrawn') return null
  return { status: 'draft', paidAt: null, reviewedAt: null }
}

/** A rejected review can be sent back without another fee. The row stays private. */
export function resubmitForSale(row: ForSaleCycle): ForSaleCycle | null {
  if (row.status !== 'rejected' || row.paidAt == null) return null
  return { status: 'paid_pending_review', paidAt: row.paidAt, reviewedAt: null }
}

/** Asking-price edits are free once the listing is up (paid, reviewed or not). */
export function canChangeAskingPrice(row: ForSaleCycle): boolean {
  return row.status === 'active' || row.status === 'paid_pending_review'
}

/** A refund must not leave the row on the public list. */
export function refundForSale(row: ForSaleCycle): ForSaleCycle {
  return { status: 'withdrawn', paidAt: null, reviewedAt: null }
}

export function parseAskingDollars(raw: unknown): number | null {
  const text = String(raw ?? '').trim().replace(/[$,\s]/g, '')
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return null
  const [whole, frac = ''] = text.split('.')
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2))
  if (!Number.isInteger(cents) || cents <= 0 || cents > 10_000_000_000) return null
  return cents
}

const LINK_RE = /https?:\/\//gi

/**
 * Spam and shape checks. Revenue and profit are not judged for truth.
 * A large seller-reported number is not a reason by itself.
 */
export function listingSpamReasons(input: {
  askingCents: number
  revenue: string
  profit: string
  team: string
  stack: string
}): string[] {
  const reasons: string[] = []
  if (!Number.isInteger(input.askingCents) || input.askingCents <= 0) reasons.push('asking_price')
  const fields = [input.revenue, input.profit, input.team, input.stack]
  if (fields.some((field) => field.length > 160)) reasons.push('too_long')
  const links = fields.join('\n').match(LINK_RE)
  if (links && links.length > 3) reasons.push('too_many_links')
  return reasons
}

export function decideForSaleReview(input: {
  action: 'approve' | 'reject'
  ownsProduct: boolean
  paid: boolean
  status: ForSaleStatus
  spam: string[]
}): { ok: true; status: 'active' | 'rejected' } | { ok: false; reason: string } {
  if (input.status !== 'paid_pending_review') return { ok: false, reason: 'not_pending' }
  if (!input.paid) return { ok: false, reason: 'not_paid' }
  if (input.action === 'reject') return { ok: true, status: 'rejected' }
  if (!input.ownsProduct) return { ok: false, reason: 'not_owner' }
  if (input.spam.length) return { ok: false, reason: 'spam' }
  return { ok: true, status: 'active' }
}

export function ownsSubmission(
  row: { owner_sub: string; owner_email: string },
  session: { sub: string; email: string },
): boolean {
  if (row.owner_sub) return row.owner_sub === session.sub
  const email = session.email.trim().toLowerCase()
  const owner = row.owner_email.trim().toLowerCase()
  return Boolean(email && owner && email === owner)
}

/** Checkout reads a listing id and nothing else from the client body. */
export function forSaleCheckoutListingId(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const record = body as Record<string, unknown>
  return String(record.listing_id || '').trim()
}

export function toPublicForSaleCard(row: {
  id: string
  product_slug: string
  product_name: string
  asking_cents: number
  revenue: string
  profit: string
  team: string
  stack: string
  status: ForSaleStatus
  paidAt: number | null
  reviewedAt: number | null
  interested: number
  owner_email?: string
  owner_sub?: string
}): PublicForSaleCard | null {
  if (!isPublicForSale({ status: row.status, paidAt: row.paidAt, reviewedAt: row.reviewedAt })) return null
  return {
    id: row.id,
    product_slug: row.product_slug,
    product_name: row.product_name,
    asking_cents: row.asking_cents,
    revenue: row.revenue.trim(),
    profit: row.profit.trim(),
    team: row.team.trim(),
    stack: row.stack.trim(),
    interested: row.interested,
  }
}
