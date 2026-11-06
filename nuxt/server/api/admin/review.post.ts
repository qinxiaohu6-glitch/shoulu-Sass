/**
 * POST /api/admin/review — approve, reject, or confirm a payment.
 *
 * Three actions, two of them editorial and one financial:
 *
 *  * `approve`  — the listing may render. Refused for a paid plan that has not
 *                 been paid for, because "approved" must not be able to buy a
 *                 dofollow link on credit;
 *  * `reject`   — the record stays. A domain that was turned down must not be
 *                 able to re-submit the same thing silently;
 *  * `payment`  — money arrived. This is the only path that publishes without
 *                 an editorial decision, which is what "paid skips the queue"
 *                 is supposed to mean.
 */

import { isAdmin } from '../../utils/admin'
import { useDb } from '../../utils/db'
import { sendSubmitError } from '../../utils/http'
import {
  approvedMail,
  paymentConfirmedMail,
  rejectedMail,
  sendMail,
  siteUrl,
} from '../../utils/mail'
import {
  adminRecord,
  confirmPayment,
  reviewSubmission,
  SubmissionError,
} from '../../utils/submissions'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return sendSubmitError(event, new SubmissionError('bad_payload'))
  }

  const id = String(body.id ?? '').trim()
  const action = String(body.action ?? '').trim()
  const notes = String(body.notes ?? '')
  const ref = String(body.ref ?? '')

  const db = await useDb(event)
  try {
    const site = siteUrl(event)

    if (action === 'payment') {
      const row = await confirmPayment(db, id, ref)
      // The buyer's receipt is the one message that is never optional in
      // spirit — they paid, so "it is live" has to reach them.
      sendMail(event, paymentConfirmedMail(row, site))
      return { ok: true, item: adminRecord(row) }
    }
    if (action !== 'approve' && action !== 'reject') {
      throw new SubmissionError('bad_action')
    }
    const row = await reviewSubmission(db, id, action, notes)
    sendMail(event, action === 'approve' ? approvedMail(row, site) : rejectedMail(row, notes, site))
    return { ok: true, item: adminRecord(row) }
  } catch (err) {
    if (err instanceof SubmissionError) return sendSubmitError(event, err)
    throw err
  }
})
