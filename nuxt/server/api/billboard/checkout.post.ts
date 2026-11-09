/**
 * POST /api/billboard/checkout — pay for one fixed Billboard tier.
 *
 * The body names a tier, a URL, and an email. It does not name a price.
 * `effectiveAmountCents('billboard', tier)` is the only amount written to
 * `payment_order` and to the pending placement. The row stays `pending`
 * until the webhook moves it to `live`, so it cannot appear on the public board.
 */

import { campaignSnapshot } from '~~/shared/content/campaign'
import { billboardTier } from '~~/shared/content/billboard'
import { effectiveAmountCents, listAmountCents } from '~~/shared/utils/pricing-effective'
import { billboardInvoiceDraft } from '~~/shared/utils/billboard'
import { insertBillboardCheckout } from '../../utils/billboard'
import { useDb } from '../../utils/db'
import { getPaymentProvider, paymentConfig, returnUrls } from '../../utils/payments'
import { attachSession, createOrder, newOrderId, setOrderStatus } from '../../utils/payments/orders'

function newBillboardId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `bb_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const body = (await readBody<{
    tier?: unknown
    url?: unknown
    email?: unknown
    name?: unknown
    tagline?: unknown
  }>(event).catch(() => null)) ?? {}

  const draft = billboardInvoiceDraft({
    tier: String(body.tier ?? ''),
    url: String(body.url ?? ''),
    email: String(body.email ?? ''),
    name: String(body.name ?? ''),
  })
  if (!draft || !billboardTier(draft.tier)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        reason: 'bad_checkout',
        message_en: 'Send a real http(s) URL, an email, and Entry, Standard or Prime.',
        message_zh: '请填写有效的 http(s) 网址、邮箱，以及入门、标准或优先档。',
      },
    })
  }

  const provider = getPaymentProvider(event)
  if (!provider) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: {
        reason: 'unconfigured',
        message_en: 'Card payment is not switched on yet — we will email you how to pay.',
        message_zh: '在线支付还没开通，我们会用邮件告诉你付款方式。',
      },
    })
  }

  const amountCents = effectiveAmountCents('billboard', draft.tier)
  const listCents = listAmountCents('billboard', draft.tier)
  if (!amountCents) {
    throw createError({ statusCode: 409, statusMessage: 'Conflict', data: { reason: 'nothing_to_pay' } })
  }

  const db = await useDb(event)
  const config = paymentConfig(event)
  const orderId = newOrderId()
  const urls = returnUrls(event, orderId)
  const placementId = newBillboardId()
  const tagline = String(body.tagline ?? '').trim().slice(0, 140)
  const tier = billboardTier(draft.tier)!

  await createOrder(db, {
    id: orderId,
    submissionId: '',
    plan: 'billboard',
    amountCents,
    currency: config.currency,
    provider: provider.id,
    buyerEmail: draft.email,
  })
  await insertBillboardCheckout(db, {
    id: placementId,
    orderId,
    tier: draft.tier,
    name: draft.name || tier.name.en,
    tagline,
    url: draft.url,
    email: draft.email,
    amountCents,
    now: Math.floor(Date.now() / 1000),
  })

  try {
    const session = await provider.createCheckout({
      orderId,
      submissionId: '',
      plan: 'billboard',
      amountCents,
      currency: config.currency,
      email: draft.email,
      description: `Billboard ${tier.name.en} — ${draft.url}`,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
    })
    await attachSession(db, orderId, session.ref, session.url)
    return {
      ok: true,
      order: orderId,
      url: session.url,
      amount_cents: amountCents,
      list_cents: listCents,
      campaign: campaignSnapshot(),
      published: false,
    }
  } catch (err) {
    console.error('[payments] billboard checkout failed', err)
    await setOrderStatus(db, orderId, 'failed', {
      note: err instanceof Error ? err.message.slice(0, 200) : 'provider_error',
    })
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
