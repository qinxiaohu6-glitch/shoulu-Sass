/**
 * Payment orders — the record of every attempt to pay.
 *
 * The submission row already has `paid_at` and `payment_ref`, and it keeps
 * them: `confirmPayment()` is still the one function that publishes a listing,
 * and it stays that way. What this table adds is the attempt history the
 * submission row cannot hold — which provider, which session, how much, and
 * whether a second webhook for the same charge was ignored.
 *
 * Nothing here writes to `submissions`. That is `confirmPayment`'s job, called
 * by the webhook route once an event has been verified and the amount checked.
 */

import type { Db } from '../db'

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'

export interface PaymentOrder {
  id: string
  submission_id: string
  plan: string
  amount_cents: number
  currency: string
  provider: string
  provider_ref: string
  status: OrderStatus
  checkout_url: string
  buyer_email: string
  note: string
  raw_event: string
  created_at: number
  updated_at: number
  paid_at: number | null
}

const now = () => Math.floor(Date.now() / 1000)

/**
 * `po_` plus 96 random bits.
 *
 * This id travels in the success URL, so it is also the only thing standing
 * between a stranger and someone else's order status. Four bytes (what the
 * submission ids use) is fine for an opaque reference nobody enumerates;
 * a payment reference deserves more headroom than "probably".
 */
export function newOrderId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return `po_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export interface CreateOrderInput {
  id: string
  submissionId: string
  plan: string
  amountCents: number
  currency: string
  provider: string
  buyerEmail: string
}

export async function createOrder(db: Db, input: CreateOrderInput): Promise<PaymentOrder> {
  const ts = now()
  await db
    .prepare(
      `INSERT INTO payment_order (
         id, submission_id, plan, amount_cents, currency, provider,
         provider_ref, status, checkout_url, buyer_email, note, raw_event,
         created_at, updated_at, paid_at
       ) VALUES (?, ?, ?, ?, ?, ?, '', 'pending', '', ?, '', '', ?, ?, NULL)`,
    )
    .bind(
      input.id,
      input.submissionId,
      input.plan,
      input.amountCents,
      input.currency,
      input.provider,
      input.buyerEmail,
      ts,
      ts,
    )
    .run()
  return (await getOrder(db, input.id))!
}

export async function getOrder(db: Db, id: string): Promise<PaymentOrder | null> {
  return db.prepare('SELECT * FROM payment_order WHERE id = ?').bind(id).first<PaymentOrder>()
}

export async function findOrderByRef(
  db: Db,
  provider: string,
  ref: string,
): Promise<PaymentOrder | null> {
  if (!ref) return null
  return db
    .prepare('SELECT * FROM payment_order WHERE provider = ? AND provider_ref = ?')
    .bind(provider, ref)
    .first<PaymentOrder>()
}

/** Attach the provider's session to the row we created before calling out. */
export async function attachSession(
  db: Db,
  id: string,
  ref: string,
  url: string,
): Promise<void> {
  await db
    .prepare('UPDATE payment_order SET provider_ref = ?, checkout_url = ?, updated_at = ? WHERE id = ?')
    .bind(ref, url, now(), id)
    .run()
}

export async function setOrderStatus(
  db: Db,
  id: string,
  status: OrderStatus,
  extra: { note?: string; raw?: string; paidAt?: number | null } = {},
): Promise<PaymentOrder | null> {
  await db
    .prepare(
      `UPDATE payment_order
          SET status = ?, note = COALESCE(?, note), raw_event = COALESCE(?, raw_event),
              paid_at = COALESCE(?, paid_at), updated_at = ?
        WHERE id = ?`,
    )
    .bind(status, extra.note ?? null, extra.raw ?? null, extra.paidAt ?? null, now(), id)
    .run()
  return getOrder(db, id)
}

/**
 * Settle an order, exactly once.
 *
 * Providers retry webhooks, and the same event arriving twice is normal rather
 * than exceptional. The transition is therefore guarded in SQL — `WHERE
 * status = 'pending'` — so the second delivery changes zero rows and the
 * caller can tell the difference between "we just settled this" and "somebody
 * else already had".
 */
export async function settleOrder(
  db: Db,
  id: string,
  raw: string,
): Promise<{ order: PaymentOrder | null; alreadySettled: boolean }> {
  const ts = now()
  const result = await db
    .prepare(
      `UPDATE payment_order
          SET status = 'paid', paid_at = ?, updated_at = ?, raw_event = ?
        WHERE id = ? AND status = 'pending'`,
    )
    .bind(ts, ts, raw, id)
    .run()

  const order = await getOrder(db, id)
  return { order, alreadySettled: Number(result?.changes ?? 0) === 0 }
}

/**
 * The console's list, with the listing's name joined in.
 *
 * A table of hex ids is unreadable — the operator's first question about an
 * order is always "which product?". The join is one statement because both
 * tables are small; doing it per row in the page would be N queries for a
 * screen that shows twenty.
 */
export type AdminOrder = PaymentOrder & {
  submission_name: string
  submission_slug: string
}

export async function listOrders(db: Db, limit = 200): Promise<AdminOrder[]> {
  const { results } = await db
    .prepare(
      `SELECT o.*,
              COALESCE(s.name, '') AS submission_name,
              COALESCE(s.slug, '') AS submission_slug
         FROM payment_order o
         LEFT JOIN submissions s ON s.id = o.submission_id
        ORDER BY o.created_at DESC
        LIMIT ?`,
    )
    .bind(limit)
    .all<AdminOrder>()
  return results
}

export async function ordersForSubmission(db: Db, submissionId: string): Promise<PaymentOrder[]> {
  const { results } = await db
    .prepare('SELECT * FROM payment_order WHERE submission_id = ? ORDER BY created_at DESC')
    .bind(submissionId)
    .all<PaymentOrder>()
  return results
}

export async function orderStats(db: Db) {
  const one = async (sql: string) =>
    Number((await db.prepare(sql).first<{ n: number }>())?.n ?? 0)
  return {
    total: await one('SELECT COUNT(*) AS n FROM payment_order'),
    pending: await one("SELECT COUNT(*) AS n FROM payment_order WHERE status = 'pending'"),
    paid: await one("SELECT COUNT(*) AS n FROM payment_order WHERE status = 'paid'"),
    // Money that arrived through the provider, in minor units. Manual
    // confirmations are not here — they never created an order.
    collected_cents: await one(
      "SELECT COALESCE(SUM(amount_cents), 0) AS n FROM payment_order WHERE status = 'paid'",
    ),
  }
}
