/**
 * POST /api/payments/webhook — the provider says the money arrived.
 *
 * Three rules, in this order:
 *
 * 1. **Verify first, parse second.** The raw body is what gets signed; letting
 *    a JSON parser near it first changes the bytes and every signature fails.
 *    `readRawBody` therefore runs before anything else touches the request.
 * 2. **A bad signature is a 400, an uninteresting event is a 200.** Providers
 *    disable endpoints that error on events they do not care about, and a
 *    scanner hitting the URL must not be able to break it either.
 * 3. **Settling is idempotent.** Providers retry. `settleOrder` only moves a
 *    row out of `pending`, so the second delivery changes nothing and the
 *    listing is not published twice.
 *
 * The amount is checked against the order before publishing. A provider that
 * says $1 was paid for a $39 listing is either a currency mismatch or a
 * tampered session, and neither should put a page live.
 */

import { confirmPayment, getSubmission } from '../../utils/submissions'
import { useDb } from '../../utils/db'
import { getPaymentProvider } from '../../utils/payments'
import { findOrderByRef, getOrder, setOrderStatus, settleOrder } from '../../utils/payments/orders'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const provider = getPaymentProvider(event)
  if (!provider) {
    // Nobody should be calling this. Answering like a missing route keeps the
    // endpoint from announcing that a console exists behind it.
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const rawBody = (await readRawBody(event, 'utf8')) || ''
  const headers = getRequestHeaders(event) as Record<string, string>

  const parsed = await provider.parseWebhook(rawBody, headers)
  if (parsed === 'ignored') {
    // Authentic, but not a state change this site tracks. 200 rather than 400:
    // providers disable endpoints that reject events they consider delivered.
    return { ok: true, ignored: 'uninteresting_event' }
  }
  if (!parsed) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'bad_signature' }
  }

  const db = await useDb(event)
  const order =
    (await findOrderByRef(db, provider.id, parsed.providerRef)) ?? (await getOrder(db, parsed.orderId))

  if (!order) {
    // A real event for an order we do not have. Logged rather than 404'd: the
    // provider did its job, and retrying will not create the row.
    console.warn('[payments] webhook for unknown order', parsed.orderId, parsed.providerRef)
    return { ok: true, ignored: 'unknown_order' }
  }

  const raw = rawBody.slice(0, 20_000)

  if (parsed.status !== 'paid') {
    await setOrderStatus(db, order.id, parsed.status, { raw })
    return { ok: true, status: parsed.status }
  }

  if (parsed.amountCents !== order.amount_cents || parsed.currency !== order.currency) {
    await setOrderStatus(db, order.id, 'failed', {
      raw,
      note: `amount mismatch: paid ${parsed.amountCents} ${parsed.currency}, expected ${order.amount_cents} ${order.currency}`,
    })
    console.error('[payments] amount mismatch', order.id, parsed.amountCents, order.amount_cents)
    // 200: this is not a delivery problem, it is a decision. Retrying would
    // only repeat it.
    return { ok: true, ignored: 'amount_mismatch' }
  }

  const { order: settled, alreadySettled } = await settleOrder(db, order.id, raw)
  if (!settled) {
    return { ok: true, ignored: 'missing_after_settle' }
  }

  if (alreadySettled) {
    // Normal: the provider retried, or two events for one session arrived.
    return { ok: true, duplicate: true, status: settled.status }
  }

  const submission = await getSubmission(db, settled.submission_id)
  if (!submission) {
    console.error('[payments] settled order has no submission', settled.id, settled.submission_id)
    return { ok: true, ignored: 'missing_submission' }
  }

  // The same function the console's "mark paid & publish" button calls, so a
  // card payment and a hand-confirmed payment cannot diverge.
  await confirmPayment(db, submission.id, `${provider.id}:${settled.id}`)

  return { ok: true, status: 'paid', order: settled.id }
})
