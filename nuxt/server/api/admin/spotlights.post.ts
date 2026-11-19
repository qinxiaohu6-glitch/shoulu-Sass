/**
 * POST /api/admin/spotlights — approve, reject or unpublish one article.
 *
 * Three actions, one endpoint, because they are three answers to the same
 * question and the queue only ever asks one at a time:
 *
 *   approve    publishes. `published_at` is set once and kept, so re-approving
 *              an unpublished article does not move its date. `slug` may be
 *              overridden — the generated one is a guess from the product name,
 *              and the owner is the last person who should be stuck with a
 *              guess.
 *   reject     keeps the row and records why. The record is what stops the same
 *              draft coming back unchanged; it also carries the reason into the
 *              mail the writer gets.
 *   unpublish  clears `published_at`, keeps the status. The article comes off
 *              the site without losing its review history, and putting it back
 *              is one click rather than a second review.
 *
 * Mail is sent after the write, never before: a failed send must not leave the
 * database disagreeing with what the writer was told.
 */

import { isAdmin } from '../../utils/admin'
import { useDb } from '../../utils/db'
import { sendSubmitError } from '../../utils/http'
import { sendMail, siteUrl, spotlightApprovedMail, spotlightRejectedMail } from '../../utils/mail'
import { reviewSpotlight, SpotlightError, type ReviewAction } from '../../utils/spotlights'

const ACTIONS: ReviewAction[] = ['approve', 'reject', 'unpublish']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return sendSubmitError(event, new SpotlightError('bad_payload'))
  }

  const id = String(body.id ?? '').trim()
  const action = String(body.action ?? '').trim() as ReviewAction
  if (!id) return sendSubmitError(event, new SpotlightError('bad_payload'))
  if (!ACTIONS.includes(action)) return sendSubmitError(event, new SpotlightError('bad_action'))

  try {
    const db = await useDb(event)
    const row = await reviewSpotlight(db, id, action, {
      slug: body.slug === undefined ? undefined : String(body.slug),
      notes: body.notes === undefined ? undefined : String(body.notes),
    })

    // Only the two decisions the writer is waiting on produce mail. An
    // unpublish is usually a temporary takedown — a mail for it would read as
    // a second rejection.
    const site = siteUrl(event)
    if (action === 'approve') sendMail(event, spotlightApprovedMail(row, site))
    if (action === 'reject') sendMail(event, spotlightRejectedMail(row, row.reviewNotes, site))

    return { ok: true, item: row }
  } catch (err) {
    if (err instanceof SpotlightError) return sendSubmitError(event, err)
    console.error('[admin-spotlights]', err)
    return sendSubmitError(event, new SpotlightError('internal_error'))
  }
})
