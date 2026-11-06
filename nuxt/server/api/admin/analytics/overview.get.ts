/**
 * GET /api/admin/analytics/overview — the four numbers on `/admin`.
 *
 * The source reads this from `admin.analytics/overview`, backed by tables this
 * build does not have (`users`, `subscription`). Everything below is derived
 * from the tables that *do* exist, so the cards show real figures instead of
 * zeros:
 *
 * - `users.total` / `new24h` — distinct `owner_sub` across submissions and
 *   tickets. This build has no user table (see `server/utils/session.ts`: the
 *   session is a signed cookie, Google is the identity provider), so "how many
 *   accounts" has no answer. "How many distinct accounts have done something"
 *   is the closest honest question, and it is what the column counts.
 * - `revenue30d` — `payment_order` rows with `status = 'paid'`, grouped by
 *   currency. Minor units, exactly as the source expects them.
 * - `subscriptions` — always `{ active: 0, trialing: 0 }`. There is no
 *   subscription table; payments here are one-off listing purchases.
 * - `openTickets` — tickets whose status is not `closed`, which is the same
 *   definition `/api/admin/tickets` uses for its queue badge.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'

const DAY = 60 * 60 * 24

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const db = await useDb(event)
  const now = Math.floor(Date.now() / 1000)
  const since = now - 30 * DAY

  /**
   * `UNION` rather than two counts added together: one person can both submit
   * and open a ticket, and counting them twice would inflate the only figure
   * on this page that claims to be a headcount.
   */
  const owners = db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(recent), 0) AS recent FROM (
       SELECT owner_sub AS sub, MAX(created_at >= ?) AS recent
         FROM submissions WHERE owner_sub <> '' GROUP BY owner_sub
       UNION
       SELECT user_sub AS sub, MAX(created_at >= ?) AS recent
         FROM ticket WHERE user_sub <> '' GROUP BY user_sub
     )`,
  )

  const revenue = db.prepare(
    `SELECT currency, COALESCE(SUM(amount_cents), 0) AS amount, COUNT(*) AS orders
       FROM payment_order
      WHERE status = 'paid' AND COALESCE(paid_at, created_at) >= ?
      GROUP BY currency
      ORDER BY amount DESC`,
  )

  const openTickets = db.prepare(`SELECT COUNT(*) AS n FROM ticket WHERE status <> 'closed'`)

  const [ownersRow, revenueRows, openRow] = await Promise.all([
    owners.bind(now - DAY, now - DAY).first<{ n: number; recent: number }>(),
    revenue.bind(since).all<{ currency: string; amount: number; orders: number }>(),
    openTickets.first<{ n: number }>(),
  ])

  return {
    users: {
      total: Number(ownersRow?.n ?? 0),
      new24h: Number(ownersRow?.recent ?? 0),
    },
    revenue30d: (revenueRows.results ?? []).map((row) => ({
      currency: String(row.currency || 'usd'),
      amount: Number(row.amount ?? 0),
      orders: Number(row.orders ?? 0),
    })),
    subscriptions: { active: 0, trialing: 0 },
    openTickets: Number(openRow?.n ?? 0),
  }
})
