/**
 * POST /api/for-sale/price — change the asking price. No new charge.
 */

import { canChangeAskingPrice, ownsSubmission, parseAskingDollars } from '~~/shared/utils/for-sale-state'
import { cycleOf, getForSale, ownerView, requireSeller, setAskingPrice } from '../../utils/for-sale'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const session = await requireSeller(event)
  const body = (await readBody(event).catch(() => null)) as { listing_id?: string; asking_price?: unknown } | null
  const listingId = String(body?.listing_id || '').trim()
  const asking = parseAskingDollars(body?.asking_price)
  if (!listingId || asking == null) throw createError({ statusCode: 400, statusMessage: 'Bad Request' })

  const db = await useDb(event)
  const row = await getForSale(db, listingId)
  if (!row || !ownsSubmission(row, session)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  if (!canChangeAskingPrice(cycleOf(row))) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: {
        reason: 'not_up',
        message_en: 'You can change the asking price after the listing is up.',
        message_zh: '上架之后才能改要价。',
      },
    })
  }
  const next = await setAskingPrice(db, row, asking)
  return { ok: true, listing: next ? ownerView(next, 0) : null }
})
