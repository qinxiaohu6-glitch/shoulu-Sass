/**
 * POST /api/admin/spotlights/create — the owner writes an article directly.
 *
 * The customer flow is `/spotlights/submit` → queue → approve. This is the
 * other door: a Featured customer mails in a draft, and the owner publishes it
 * without asking them to retype it into a form. Same fields, same validation,
 * same table — only the review step is skipped, because the person doing the
 * reviewing is the person typing.
 *
 * `publish: false` stores it as a pending draft instead, which is the honest
 * option when the owner wants to paste something in now and read it properly
 * later. A draft made this way appears in the queue like any other, so there is
 * one place to look for "what still needs a decision".
 *
 * The write is composed from the two functions the public flow already uses —
 * `createSpotlight` then `reviewSpotlight('approve')` — rather than a third
 * insert. That means slug generation, the one-article-per-product rule and the
 * reserved-segment check all behave identically no matter which door was used.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { sendSubmitError } from '../../../utils/http'
import { sendMail, siteUrl, spotlightApprovedMail } from '../../../utils/mail'
import { loadEligibleListedAt } from '../../../utils/eligible-listings'
import {
  createSpotlight,
  reviewSpotlight,
  SpotlightError,
  validateDraft,
} from '../../../utils/spotlights'
import { isSpotlightSlug, isReservedSpotlightSlug } from '~~/shared/content/spotlights'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    return sendSubmitError(event, new SpotlightError('bad_payload'))
  }

  try {
    const db = await useDb(event)
    const listed = await loadEligibleListedAt(db)
    // No reply address required: the owner may have only the article.
    const draft = validateDraft(body, (slug) => listed.has(slug), { requireEmail: false })

    // The slug is optional. Checked before the insert so a typo is reported as
    // a slug problem rather than surfacing after a row already exists.
    const wanted = String(body.slug ?? '').trim().toLowerCase()
    if (wanted && (!isSpotlightSlug(wanted) || isReservedSpotlightSlug(wanted))) {
      throw new SpotlightError('spotlight_slug_taken', 'slug')
    }

    const publish = body.publish !== false
    const created = await createSpotlight(db, draft, '')
    const row = publish
      ? await reviewSpotlight(db, created.id, 'approve', { slug: wanted || undefined })
      : created

    if (publish && row.email) sendMail(event, spotlightApprovedMail(row, siteUrl(event)))

    setResponseStatus(event, 201)
    return { ok: true, item: row }
  } catch (err) {
    if (err instanceof SpotlightError) return sendSubmitError(event, err)
    console.error('[admin-spotlights-create]', err)
    return sendSubmitError(event, new SpotlightError('internal_error'))
  }
})
