/**
 * POST /api/for-sale/unlist — seller takes the row off the public list.
 * sold | withdrawn. Another $9.90 is required to list it again.
 */

import { ownsSubmission } from '~~/shared/utils/for-sale-state'
import { getForSale, ownerView, requireSeller, unlistListing } from '../../utils/for-sale'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const session = await requireSeller(event)
  const body = (await readBody(event).catch(() => null)) as { listing_id?: string; reason?: string } | null
  const listingId = String(body?.listing_id || '').trim()
  const reason = body?.reason === 'sold' || body?.reason === 'withdrawn' ? body.reason : ''
  if (!listingId || !reason) throw createError({ statusCode: 400, statusMessage: 'Bad Request' })

  const db = await useDb(event)
  const row = await getForSale(db, listingId)
  if (!row || !ownsSubmission(row, session)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const next = await unlistListing(db, row, reason)
  if (!next) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: {
        reason: 'not_listed',
        message_en: 'Only a listing that is up can be unlisted.',
        message_zh: '只有已上架的待售可以下架。',
      },
    })
  }
  return { ok: true, listing: ownerView(next, 0) }
})
