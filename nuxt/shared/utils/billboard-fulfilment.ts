/**
 * Billboard payment state, without a database.
 *
 * A public row is live and has a confirmed timestamp. Paying a pending row
 * makes exactly that row live. Paying it again does not create another row.
 * A removed row stays down. An unpaid row is never public.
 */

export type BillboardFulfilStatus = 'requested' | 'pending' | 'live' | 'removed'

export type FulfilRow = {
  id: string
  status: string
  paidAt: number | null
}

export type FulfilDecision =
  | { ok: true; id: string; duplicate: boolean }
  | { ok: false; reason: 'missing' | 'removed' }

export function isPublicBillboard(row: { status?: string; paidAt?: number | null }): boolean {
  return row.status === 'live' && typeof row.paidAt === 'number' && Number.isFinite(row.paidAt)
}

/** What one paid webhook (or one manual fulfil) may do to a single row. */
export function decideBillboardFulfilment(row: FulfilRow | null): FulfilDecision {
  if (!row) return { ok: false, reason: 'missing' }
  if (row.status === 'removed') return { ok: false, reason: 'removed' }
  if (row.status === 'live' && typeof row.paidAt === 'number') {
    return { ok: true, id: row.id, duplicate: true }
  }
  if (row.status === 'pending' || row.status === 'requested' || row.status === 'live') {
    return { ok: true, id: row.id, duplicate: false }
  }
  return { ok: false, reason: 'missing' }
}
