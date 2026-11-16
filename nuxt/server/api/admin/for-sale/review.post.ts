/**
 * POST /api/admin/for-sale/review — approve or reject.
 *
 * Approve requires a paid row, current ownership of the live product, and no
 * spam flags. It does not verify revenue or profit. Reject stays private.
 * Passing review is what makes a paid row public.
 */

import { decideForSaleReview, listingSpamReasons, ownsSubmission } from '~~/shared/utils/for-sale-state'
import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { cycleOf, getForSale, reviewListing } from '../../../utils/for-sale'
import { getPublicBySlug } from '../../../utils/submissions'
import { sendMail } from '../../../utils/mail'
import { siteUrl } from '../../../utils/mail'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (!isAdmin(event)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const body = (await readBody(event).catch(() => null)) as { id?: string; action?: string } | null
  const id = String(body?.id || '').trim()
  const action = body?.action === 'approve' || body?.action === 'reject' ? body.action : ''
  if (!id || !action) throw createError({ statusCode: 400, statusMessage: 'Bad Request' })

  const db = await useDb(event)
  const row = await getForSale(db, id)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const product = await getPublicBySlug(db, row.product_slug)
  const owns = Boolean(product && ownsSubmission(product, { sub: row.owner_sub, email: row.owner_email }))
  const spam = listingSpamReasons({
    askingCents: row.asking_cents,
    revenue: row.revenue,
    profit: row.profit,
    team: row.team,
    stack: row.stack,
  })
  const decision = decideForSaleReview({
    action,
    ownsProduct: owns,
    paid: row.paid_at != null,
    status: cycleOf(row).status,
    spam,
  })
  if (!decision.ok) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: {
        reason: decision.reason,
        message_en: 'This for-sale row cannot be approved. Check payment, ownership, and spam. Income is not verified.',
        message_zh: '这条待售不能通过。请检查付款、所有权和垃圾信息。收入不在这里核实。',
      },
    })
  }

  const next = await reviewListing(db, row, decision.status === 'active', 'admin')
  if (!next) throw createError({ statusCode: 409, statusMessage: 'Conflict' })

  if (decision.status === 'active') {
    const site = siteUrl(event)
    sendMail(event, {
      to: row.owner_email,
      subject: `${row.product_name || 'Your listing'} is on the for-sale list`,
      text:
        `${row.product_name || 'Your product'} is now on the public for-sale list.\n\n` +
        `Buyers contact you after they sign in. We do not publish your email. ` +
        `Product Atlas does not hold the money or guarantee a sale.\n\n` +
        `${site}/for-sale\n\n— Product Atlas\n`,
    })
  }

  return {
    ok: true,
    item: {
      id: next.id,
      status: next.status,
      public: decision.status === 'active',
    },
  }
})
