/**
 * POST /api/for-sale/resubmit — send a rejected, already-paid row back to review.
 * No second fee. Still not public.
 */

import { ownsSubmission } from '~~/shared/utils/for-sale-state'
import { getForSale, ownerView, requireSeller, resubmitListing } from '../../utils/for-sale'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const session = await requireSeller(event)
  const body = (await readBody(event).catch(() => null)) as { listing_id?: string } | null
  const listingId = String(body?.listing_id || '').trim()
  if (!listingId) throw createError({ statusCode: 400, statusMessage: 'Bad Request' })

  const db = await useDb(event)
  const row = await getForSale(db, listingId)
  if (!row || !ownsSubmission(row, session)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const next = await resubmitListing(db, row)
  if (!next) throw createError({ statusCode: 409, statusMessage: 'Conflict' })
  return { ok: true, listing: ownerView(next, 0) }
})
