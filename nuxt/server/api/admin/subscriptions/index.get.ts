/**
 * GET /api/admin/subscriptions — the subscription list.
 *
 * Source `server/admin/handlers/subscriptions.ts` reads a `subscription` table.
 * This build sells one-off listings through `payment_order`; nothing renews, so
 * there is no subscription row to list and the page renders the source's own
 * empty table. `/admin/payments` answers the same way when its
 * `paymentType=subscription` tab is opened.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return { ok: true, items: [], total: 0 }
})
