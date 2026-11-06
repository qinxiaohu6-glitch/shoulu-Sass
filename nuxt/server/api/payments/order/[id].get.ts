/**
 * GET /api/payments/order/:id — what happened to my payment?
 *
 * The order id is 96 random bits and travels only in the URL the provider
 * redirects back to, so it doubles as the capability: knowing it is the proof
 * that you were the buyer. Nothing here is worth harvesting even so — no email,
 * no address, no provider session id — only the state of the purchase and the
 * listing it belongs to.
 *
 * The return page polls this while a payment settles, which is why it answers
 * on every request rather than caching.
 */

import { useDb } from '../../../utils/db'
import { getSubmission } from '../../../utils/submissions'
import { getOrder } from '../../../utils/payments/orders'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const id = String(getRouterParam(event, 'id') || '').trim()
  if (!id) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const db = await useDb(event)
  const order = await getOrder(db, id)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const submission = await getSubmission(db, order.submission_id)

  return {
    ok: true,
    order: {
      id: order.id,
      status: order.status,
      plan: order.plan,
      amount_cents: order.amount_cents,
      currency: order.currency,
      created_at: order.created_at,
      paid_at: order.paid_at,
      // The listing's public identity, so the page can say which product this
      // was without exposing the submitter's address.
      name: submission?.name ?? '',
      slug: submission?.slug ?? '',
      live: Boolean(submission?.status === 'approved' && submission?.paid_at),
    },
  }
})
