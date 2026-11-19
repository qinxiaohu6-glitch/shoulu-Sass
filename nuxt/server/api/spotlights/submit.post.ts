/**
 * POST /api/spotlights/submit — a writer's draft, into the queue.
 *
 * The public form is the only caller. It answers 201 with the slug the draft
 * will publish at and nothing else: the record carries the submitter's address
 * and the owner's notes, and neither belongs in a response the browser keeps.
 *
 * Three refusals worth reading:
 *
 *  - **`spotlight_no_listing`** — the product is not in the directory. A
 *    Spotlight links to a live listing, so there is nothing to write about yet.
 *    The form's picker is built from the same directory, so this is the case of
 *    a stale tab or a hand-rolled request.
 *  - **`spotlight_duplicate`** — one article per product. Pending and approved
 *    both block; a rejected draft does not, because the point of a rejection is
 *    that it can be fixed and sent again.
 *  - **`rate_limited`** — counted twice, by address and by source. The address
 *    limit stops one person re-sending; the source limit stops one person
 *    cycling through addresses.
 *
 * No sign-in. The submission wizard requires Google because a listing has to be
 * claimed and edited later; a Spotlight is a one-shot draft with a reply
 * address, and adding an OAuth step before a 1,200-word form is the fastest way
 * to get no drafts at all.
 */

import { useDb } from '../../utils/db'
import { clientIp, hashIp, sendSubmitError } from '../../utils/http'
import { ownerInbox, sendMail, siteUrl, spotlightInboxMail, spotlightSubmittedMail } from '../../utils/mail'
import { loadEligibleListedAt } from '../../utils/eligible-listings'
import {
  createSpotlight,
  recentFromEmail,
  recentFromIp,
  SpotlightError,
  validateDraft,
} from '../../utils/spotlights'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  if (!body || typeof body !== 'object') {
    return sendSubmitError(event, new SpotlightError('bad_payload'))
  }

  try {
    const db = await useDb(event)
    const listed = await loadEligibleListedAt(db)
    const draft = validateDraft(body as Record<string, unknown>, (slug) => listed.has(slug))

    const ipHash = await hashIp(clientIp(event), event)
    if (await recentFromEmail(db, draft.email, 60 * 60)) {
      throw new SpotlightError('rate_limited', 'email')
    }
    if (await recentFromIp(db, ipHash, 60 * 60, 3)) {
      throw new SpotlightError('rate_limited')
    }

    const row = await createSpotlight(db, draft, ipHash)

    // Fire and forget: an unconfigured mailer is a no-op, and neither message
    // may delay the receipt the writer is waiting for.
    const site = siteUrl(event)
    sendMail(event, spotlightSubmittedMail(row, site))
    const inbox = ownerInbox(event)
    if (inbox) sendMail(event, spotlightInboxMail(inbox, row, site))

    setResponseStatus(event, 201)
    return {
      ok: true,
      slug: row.slug,
      productName: row.productName,
      status: row.status,
      words: row.body.trim().split(/\s+/).filter(Boolean).length,
    }
  } catch (err) {
    if (err instanceof SpotlightError) return sendSubmitError(event, err)
    console.error('[spotlight-submit]', err)
    return sendSubmitError(event, new SpotlightError('internal_error'))
  }
})
