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
import { getAdBooking } from '../../../utils/ad-bookings'
import { getOrder } from '../../../utils/payments/orders'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const id = String(getRouterParam(event, 'id') || '').trim()
  if (!id) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const db = await useDb(event)
  const order = await getOrder(db, id)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  // An ad order has no submission; the return page shows its window instead.
  // Nothing sensitive is exposed here — no email, no session id, no creative.
  const booking = order.plan === 'ad' ? await getAdBooking(db, order.id) : null
  const submission = order.submission_id ? await getSubmission(db, order.submission_id) : null

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
      /**
       * Carried so the return page can offer "try again" after a cancellation.
       * It is the same capability the order id already is — the checkout route
       * takes a submission id and charges the price on the server, so knowing
       * it lets a buyer pay, not take.
       */
      submission_id: order.submission_id,
      // The listing's public identity, so the page can say which product this
      // was without exposing the submitter's address. For an ad order this is
      // the slot and the rented window instead.
      name: booking
        ? `${booking.slot === 'board' ? 'Board slot' : 'Sidebar slot'} · ${booking.start} → ${booking.end}`
        : (submission?.name ?? ''),
      slug: submission?.slug ?? '',
      live: booking
        ? booking.status === 'live'
        : Boolean(submission?.status === 'approved' && submission?.paid_at),
      ad: booking
        ? {
            slot: booking.slot,
            weeks: booking.weeks,
            start: booking.start,
            end: booking.end,
            status: booking.status,
          }
        : null,
    },
  }
})
