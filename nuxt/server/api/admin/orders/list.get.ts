/**
 * GET /api/admin/orders/list — the ported console's order list.
 *
 * Why this is not `/api/admin/orders`: that route already exists and is the
 * *legacy* console's (`app/pages/admin/orders.vue`) — it answers with raw
 * `payment_order` rows plus provider wiring state, and its page reads exactly
 * those keys. The source's page wants a paged, filtered, camelCase list
 * (`orders.ts` → `orders_list`). Both consoles are on screen until the owner
 * decides which one to keep, so they get two routes instead of one route with
 * two shapes.
 *
 * Mapping notes, all forced by this build's `payment_order` table:
 *   `orderNo`       ← `id` (the `po_…` reference; there is no separate number)
 *   `userId`        ← the listing's owner (`submissions.owner_sub`), because an
 *                     order row itself carries no account
 *   `productId`     ← the submission the payment was for
 *   `productName`   ← that submission's name
 *   `amount`        ← `amount_cents`; the page divides by 100, as the source does
 *   `paymentType`   ← always `one-time`: nothing here renews or subscribes
 *   `status`        ← `pending | paid | failed | cancelled | refunded`
 *
 * The source's per-order product copy (`description`), its credit grant
 * (`creditsAmount`), its subscription link (`subscriptionNo`) and its refund
 * bookkeeping (`refundAmount` / `refundedAt`) have no column here and come back
 * empty, so the console renders the source's own "—" and hides the
 * subscription checkbox in the refund dialog.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

interface OrderRow {
  id: string
  status: string
  amount_cents: number
  currency: string
  provider: string
  created_at: number
  paid_at: number | null
  submission_id: string
  submission_name: string
  owner_sub: string
  owner_email: string
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)
  const str = (key: string) => (typeof query[key] === 'string' ? (query[key] as string).trim() : '')

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.pageSize) || DEFAULT_PAGE_SIZE))
  const status = str('status')
  const paymentType = str('paymentType')
  const search = str('search')
  const userId = str('userId')

  // `subscription` / `renew` are source vocabulary for a billing model this
  // build does not have; asking for them is answered with the empty list rather
  // than by silently returning one-time payments under a different label.
  if (paymentType === 'subscription' || paymentType === 'renew') {
    return { ok: true, items: [], total: 0 }
  }

  const clauses: string[] = []
  const params: (string | number)[] = []
  if (userId) {
    clauses.push('s.owner_sub = ?')
    params.push(userId)
  }
  if (status && status !== 'all') {
    clauses.push('o.status = ?')
    params.push(status)
  }
  if (search) {
    clauses.push('(o.id LIKE ? OR s.name LIKE ? OR s.owner_email LIKE ? OR s.owner_sub LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const db = await useDb(event)
  const from = 'FROM payment_order o LEFT JOIN submissions s ON s.id = o.submission_id'

  const total = Number(
    (await db.prepare(`SELECT COUNT(*) AS n ${from} ${where}`).bind(...params).first<{ n: number }>())?.n ?? 0,
  )

  const { results } = await db
    .prepare(
      `SELECT o.id, o.status, o.amount_cents, o.currency, o.provider,
              o.created_at, o.paid_at,
              COALESCE(s.id, '') AS submission_id,
              COALESCE(s.name, '') AS submission_name,
              COALESCE(s.owner_sub, '') AS owner_sub,
              COALESCE(s.owner_email, '') AS owner_email
         ${from} ${where}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT ? OFFSET ?`,
    )
    .bind(...params, pageSize, (page - 1) * pageSize)
    .all<OrderRow>()

  return {
    ok: true,
    total,
    items: results.map((row) => ({
      id: row.id,
      orderNo: row.id,
      userId: row.owner_sub,
      userName: '',
      userEmail: row.owner_email,
      userAccountEmail: row.owner_email,
      userImage: null,
      status: row.status,
      amount: row.amount_cents,
      currency: row.currency,
      paymentType: 'one-time',
      paymentProvider: row.provider,
      productId: row.submission_id || null,
      productName: row.submission_name || null,
      description: null,
      createdAt: new Date(row.created_at * 1000).toISOString(),
      paidAt: row.paid_at ? new Date(row.paid_at * 1000).toISOString() : null,
      paymentAmount: null,
      creditsAmount: null,
      subscriptionNo: null,
      refundAmount: null,
      refundedAt: null,
    })),
  }
})
