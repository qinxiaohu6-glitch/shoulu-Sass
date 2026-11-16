/**
 * POST /api/for-sale/relist — move an unlisted row back to an unpaid draft.
 * Does not charge and does not publish. Checkout is a separate call.
 */

import { ownsSubmission } from '~~/shared/utils/for-sale-state'
import { getForSale, ownerView, relistListing, requireSeller } from '../../utils/for-sale'
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
  const next = await relistListing(db, row)
  if (!next) throw createError({ statusCode: 409, statusMessage: 'Conflict' })
  return {
    ok: true,
    listing: ownerView(next, 0),
    message_en: 'Listing again costs another $9.90. The row stays private until that payment succeeds and review passes.',
    message_zh: '再次上架需要再付 $9.90。付款成功并通过审核之前不会公开。',
  }
})
