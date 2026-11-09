/**
 * Turn a paid Billboard order into one live row.
 *
 * Lookup is by `order_id`, so a second webhook updates the same row and
 * cannot insert another. Unpaid statuses stay off `listLiveBillboard`.
 */

import { decideBillboardFulfilment } from '~~/shared/utils/billboard-fulfilment'
import type { Db } from './db'

type StoredPlacement = {
  id: string
  status: string
  paid_at: number | null
  order_id: string
}

export async function findBillboardByOrder(db: Db, orderId: string): Promise<StoredPlacement | null> {
  if (!orderId) return null
  return db
    .prepare(
      `SELECT id, status, paid_at, order_id
         FROM billboard_placement
        WHERE order_id = ?`,
    )
    .bind(orderId)
    .first<StoredPlacement>()
}

export async function activateBillboardPlacement(
  db: Db,
  orderId: string,
  now = Math.floor(Date.now() / 1000),
): Promise<{ ok: true; id: string; duplicate: boolean } | { ok: false; reason: 'missing' | 'removed' }> {
  const row = await findBillboardByOrder(db, orderId)
  const decision = decideBillboardFulfilment(
    row ? { id: row.id, status: row.status, paidAt: row.paid_at } : null,
  )
  if (!decision.ok || decision.duplicate) return decision
  await db
    .prepare(
      `UPDATE billboard_placement
          SET status = 'live', paid_at = COALESCE(paid_at, ?)
        WHERE id = ? AND status IN ('pending', 'requested', 'live')`,
    )
    .bind(now, decision.id)
    .run()
  return decision
}

/** Refund or operator takedown. `paid_at` is kept so the invoice still exists. */
export async function deactivateBillboardPlacement(db: Db, orderId: string): Promise<void> {
  if (!orderId) return
  await db
    .prepare(`UPDATE billboard_placement SET status = 'removed' WHERE order_id = ? AND status = 'live'`)
    .bind(orderId)
    .run()
}

export async function setBillboardStatus(
  db: Db,
  id: string,
  status: 'live' | 'removed' | 'pending' | 'requested',
  extra: { paidAt?: number | null; note?: string } = {},
): Promise<void> {
  const note = extra.note ?? null
  if (status === 'live') {
    const paidAt = extra.paidAt ?? Math.floor(Date.now() / 1000)
    await db
      .prepare(
        `UPDATE billboard_placement
            SET status = 'live', paid_at = COALESCE(paid_at, ?), note = COALESCE(?, note)
          WHERE id = ?`,
      )
      .bind(paidAt, note, id)
      .run()
    return
  }
  await db
    .prepare(`UPDATE billboard_placement SET status = ?, note = COALESCE(?, note) WHERE id = ?`)
    .bind(status, note, id)
    .run()
}
