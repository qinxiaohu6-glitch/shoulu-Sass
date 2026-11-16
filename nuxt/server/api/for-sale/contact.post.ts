/**
 * POST /api/for-sale/contact — a signed-in buyer messages the seller.
 *
 * The response is { ok, interested }. The seller address is used as the mail
 * recipient and is not returned. The public list never includes it.
 */

import { isPublicForSale } from '~~/shared/utils/for-sale-state'
import { cycleOf, getForSale, missingForSaleTable, recordInterest } from '../../utils/for-sale'
import { useDb } from '../../utils/db'
import { sendMail } from '../../utils/mail'
import { readSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const session = await readSession(event)
  if (!session?.sub) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      data: {
        reason: 'sign_in',
        message_en: 'Sign in to send a message.',
        message_zh: '登录后才能发消息。',
      },
    })
  }

  const body = (await readBody(event).catch(() => null)) as { listing_id?: string; message?: string } | null
  const listingId = String(body?.listing_id || '').trim()
  const message = String(body?.message || '').trim()
  if (!listingId || message.length < 1 || message.length > 2000) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }
  const links = message.match(/https?:\/\//gi)
  if (links && links.length > 5) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        reason: 'spam',
        message_en: 'That message has too many links.',
        message_zh: '这条消息里的链接太多了。',
      },
    })
  }

  const db = await useDb(event)
  let listing
  try {
    listing = await getForSale(db, listingId)
  } catch (err) {
    if (missingForSaleTable(err)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    throw err
  }
  if (!listing || !isPublicForSale(cycleOf(listing))) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  if (listing.owner_sub === session.sub) {
    throw createError({ statusCode: 409, statusMessage: 'Conflict' })
  }

  const interested = await recordInterest(db, listing.id, session.sub, message)
  sendMail(event, {
    to: listing.owner_email,
    subject: `A buyer wrote about ${listing.product_name || 'your listing'}`,
    text:
      `A signed-in buyer sent a message about ${listing.product_name || 'your for-sale listing'}.\n\n` +
      `${message}\n\n` +
      `Buyer email: ${session.email}\n\n` +
      `Reply from your own inbox if you want to continue. Product Atlas does not publish your email, ` +
      `does not hold the money, and does not guarantee a sale.\n\n— Product Atlas\n`,
  })

  return { ok: true, interested }
})
