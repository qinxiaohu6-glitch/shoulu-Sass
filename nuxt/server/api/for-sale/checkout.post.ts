/**
 * POST /api/for-sale/checkout — pay the one-time listing fee.
 *
 * The body is a listing id. The charge is forSaleAmountCents() (990 USD cents).
 * A missing dedicated product id is the same closed checkout as a missing
 * provider: no order is marked paid, and the response does not offer an invoice
 * or an emailed payment method.
 */

import { CHECKOUT_CLOSED_EN, CHECKOUT_CLOSED_ZH, forSaleAmountCents } from '~~/shared/content/for-sale'
import { forSaleCheckoutListingId } from '~~/shared/utils/for-sale-state'
import {
  FOR_SALE_KIND,
  forSaleSkuReady,
  getForSale,
  missingForSaleTable,
  requireSeller,
  sellerMayPay,
} from '../../utils/for-sale'
import { useDb } from '../../utils/db'
import { ownsSubmission } from '~~/shared/utils/for-sale-state'
import { getPublicBySlug } from '../../utils/submissions'
import { getPaymentProvider, returnUrls } from '../../utils/payments'
import { attachSession, createOrder, newOrderId, setOrderStatus } from '../../utils/payments/orders'
import { PaymentError } from '../../utils/payments/types'

function closed() {
  return createError({
    statusCode: 409,
    statusMessage: 'Conflict',
    data: {
      reason: 'unconfigured',
      message_en: CHECKOUT_CLOSED_EN,
      message_zh: CHECKOUT_CLOSED_ZH,
    },
  })
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const session = await requireSeller(event)

  const provider = getPaymentProvider(event)
  if (!provider || !forSaleSkuReady(event)) throw closed()

  const body = await readBody(event).catch(() => null)
  const listingId = forSaleCheckoutListingId(body)
  if (!listingId) throw createError({ statusCode: 400, statusMessage: 'Bad Request' })

  const db = await useDb(event)
  let listing
  try {
    listing = await getForSale(db, listingId)
  } catch (err) {
    if (missingForSaleTable(err)) throw closed()
    throw err
  }
  if (!listing) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  if (!ownsSubmission(listing, session)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const product = await getPublicBySlug(db, listing.product_slug)
  if (!product || !ownsSubmission(product, session)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      data: {
        reason: 'not_owner',
        message_en: 'You can list a product for sale only when you own its live directory page.',
        message_zh: '只有你名下已上线的目录页可以上架待售。',
      },
    })
  }
  if (!sellerMayPay(listing)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: {
        reason: 'already_paid',
        message_en: 'This listing fee is already paid. You can change the asking price at no extra charge.',
        message_zh: '这笔上架费已经付过。改要价不另收费。',
      },
    })
  }

  const open = await db
    .prepare(
      `SELECT id, checkout_url FROM payment_order
        WHERE submission_id = ? AND plan = ? AND status = 'pending'
        ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(listing.id, FOR_SALE_KIND)
    .first<{ id: string; checkout_url: string }>()
  if (open?.checkout_url) {
    return { ok: true, order: open.id, url: open.checkout_url, amount_cents: forSaleAmountCents() }
  }
  if (open) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: {
        reason: 'checkout_open',
        message_en: 'A payment is already open for this listing. Finish it, or try again in a moment.',
        message_zh: '这笔上架费已经有一个未完成的付款。请先完成它，或稍后再试。',
      },
    })
  }

  const amountCents = forSaleAmountCents()
  const orderId = newOrderId()
  const urls = returnUrls(event, orderId)
  await createOrder(db, {
    id: orderId,
    submissionId: listing.id,
    plan: FOR_SALE_KIND,
    amountCents,
    currency: 'usd',
    provider: provider.id,
    buyerEmail: session.email,
  })

  try {
    const sessionCheckout = await provider.createCheckout({
      orderId,
      submissionId: listing.id,
      plan: FOR_SALE_KIND,
      amountCents,
      currency: 'usd',
      email: session.email,
      description: `${listing.product_name} — for-sale listing fee`,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
    })
    await attachSession(db, orderId, sessionCheckout.ref, sessionCheckout.url)
    return { ok: true, order: orderId, url: sessionCheckout.url, amount_cents: amountCents }
  } catch (err) {
    console.error('[payments] for-sale checkout failed', err)
    const note = err instanceof Error ? err.message.slice(0, 200) : 'provider_error'
    await setOrderStatus(db, orderId, 'failed', { note })
    if (err instanceof PaymentError && err.code === 'not_configured') throw closed()
    throw createError({
      statusCode: 502,
      statusMessage: 'Bad Gateway',
      data: {
        reason: 'provider_error',
        message_en: 'The payment provider did not answer. Please try again in a moment.',
        message_zh: '支付服务没有响应，请稍后再试。',
      },
    })
  }
})
