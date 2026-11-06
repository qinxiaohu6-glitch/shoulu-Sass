/**
 * POST /api/admin/submission-detail — save the operator's editorial copy.
 *
 * A separate write path from `/api/admin/review` on purpose: filling in a
 * "How to use" section is not an approval. Keeping the two apart means this
 * endpoint can never change `status`, mark a payment as received, or send one
 * of the review emails. The queue can be edited before or after approval
 * without disturbing either state machine.
 *
 * Authorisation is the shared console gate — no cookie, 404 — and the body is
 * normalised before it reaches D1, because this copy is rendered as HTML on a
 * public product page.
 */

import { isAdmin } from '../../utils/admin'
import { useDb } from '../../utils/db'
import { sendSubmitError } from '../../utils/http'
import {
  adminRecord,
  normalizeDetail,
  normalizeShots,
  saveSubmissionDetail,
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
  if (!id) {
    return sendSubmitError(event, new SubmissionError('not_found'))
  }

  const db = await useDb(event)
  try {
    const row = await saveSubmissionDetail(db, id, {
      detail_en: normalizeDetail(body.detail_en),
      detail_zh: normalizeDetail(body.detail_zh),
      shots: normalizeShots(body.shots),
    })
    return { ok: true, item: adminRecord(row) }
  } catch (err) {
    if (err instanceof SubmissionError) return sendSubmitError(event, err)
    throw err
  }
})
