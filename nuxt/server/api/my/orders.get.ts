/**
 * GET /api/my/orders — the signed-in account's payment history.
 *
 * The source answers this from `/api/user/orders`. This build has no user
 * table, so ownership is resolved the way the rest of the app resolves it: an
 * order belongs to whoever owns the submission it was created for. One join,
 * `payment_order → submissions`, and `owner_sub` decides.
 *
 * `paymentType` is accepted for parity with the source's tabs, and every row
 * this build can produce is `one-time`: the plans are a one-off listing fee.
 * Asking for `subscription` or `renew` therefore returns an empty page rather
 * than an error — the same answer the source gives a customer who has never
 * subscribed.
 *
 * Signed out answers an empty page instead of 401, matching
 * `/api/my/submissions`: the settings layout already redirects, so a 401 here
 * would only ever be seen by that redirect racing a slow cookie.
 */

import { useDb } from '../../utils/db'
import { readSession } from '../../utils/session'

interface OrderRow {
  id: string
  plan: string
  amount_cents: number
  currency: string
  provider: string
  status: string
  created_at: number
  paid_at: number | null
  name: string
  slug: string
}

const ONE_TIME = 'one-time'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const me = await readSession(event)
  if (!me?.sub) return { ok: true, items: [], total: 0 }

  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
  const offset = Math.max(Number(query.offset) || 0, 0)

  const paymentType = String(query.paymentType ?? '')
  if (paymentType && paymentType !== ONE_TIME) {
    // No subscription plans exist here — see the header.
    return { ok: true, items: [], total: 0 }
  }

  const where: string[] = ['s.owner_sub = ?']
  const binds: unknown[] = [me.sub]

  const status = String(query.status ?? '').trim()
  if (status) {
    where.push('o.status = ?')
    binds.push(status)
  }

  const search = String(query.search ?? '').trim()
  if (search) {
    // Escape LIKE's own wildcards, or a query of `%` matches every row.
    const like = `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
    where.push("(o.id LIKE ? ESCAPE '\\' OR s.name LIKE ? ESCAPE '\\')")
    binds.push(like, like)
  }

  const clause = where.join(' AND ')
  const db = await useDb(event)

  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS n
         FROM payment_order o JOIN submissions s ON s.id = o.submission_id
        WHERE ${clause}`,
    )
    .bind(...binds)
    .first<{ n: number }>()

  const { results } = await db
    .prepare(
      `SELECT o.id, o.plan, o.amount_cents, o.currency, o.provider, o.status,
              o.created_at, o.paid_at, s.name, s.slug
         FROM payment_order o JOIN submissions s ON s.id = o.submission_id
        WHERE ${clause}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT ? OFFSET ?`,
    )
    .bind(...binds, limit, offset)
    .all<OrderRow>()

  return {
    ok: true,
    items: results.map((row) => ({
      id: row.id,
      // The source has a separate human-facing `orderNo`; this build's id is
      // already short and opaque, so it is shown as-is.
      order_no: row.id,
      status: row.status,
      amount_cents: row.amount_cents,
      currency: row.currency,
      provider: row.provider,
      payment_type: ONE_TIME,
      product_name: row.name,
      plan_name: row.plan,
      // No invoice generator in this build.
      invoice_url: null,
      paid_at: row.paid_at,
      created_at: row.created_at,
      slug: row.slug,
    })),
    total: countRow?.n ?? 0,
  }
})
