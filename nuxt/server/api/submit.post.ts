/**
 * POST /api/submit — the submit wizard's only write.
 *
 * Returns 201 with the record the submitter is allowed to see, plus `next`
 * telling the form which screen to show: `review` for a free listing, `paid`
 * for anything that has to wait on an operator confirming the money. The
 * queue position is the honest answer — saying "published" when a human still
 * has to look at it is how a directory loses trust on day one.
 */

import { useDb } from '../utils/db'
import { createSubmission, publicRecord, SubmissionError } from '../utils/submissions'
import { clientIp, hashIp, sendSubmitError } from '../utils/http'
import { ownerInbox, sendMail, siteUrl, submissionInboxMail, submittedMail } from '../utils/mail'
import { readSession } from '../utils/session'
import { submissionSessionOwner } from '~~/shared/utils/listing-desk'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object') {
    return sendSubmitError(event, new SubmissionError('bad_payload'))
  }

  try {
    const db = await useDb(event)
    const ipHash = await hashIp(clientIp(event), event)
    // Google session is required. Anonymous createSubmission is what filled the
    // review queue with rows that never appear under /api/admin/users. Existing
    // anonymous pending rows are left as they are — this does not delete or
    // backfill them.
    const owner = submissionSessionOwner(await readSession(event))
    if (!owner) throw new SubmissionError('submit_signin_required')
    const row = await createSubmission(db, body, {
      ipHash,
      owner,
    })

    // Fire and forget: an unconfigured mailer is a no-op, and a slow one must
    // not delay the receipt the submitter is waiting for. The owner ping uses
    // the same inbox as a new ticket and is skipped when that address is unset.
    const site = siteUrl(event)
    sendMail(event, submittedMail(row, site))
    const inbox = ownerInbox(event)
    if (inbox) sendMail(event, submissionInboxMail(inbox, row, site))

    setResponseStatus(event, 201)
    return {
      ok: true,
      ...publicRecord(row),
      next: row.awaiting_payment ? 'paid' : 'review',
    }
  } catch (err) {
    if (err instanceof SubmissionError) return sendSubmitError(event, err)
    console.error('[submit]', err)
    return sendSubmitError(event, new SubmissionError('internal_error'))
  }
})
