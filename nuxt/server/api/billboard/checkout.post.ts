/**
 * POST /api/billboard/checkout — pay a chosen backing amount.
 *
 * The body names a URL, an email, and whole-dollar cents. The server clamps
 * that amount to the $15 floor and refuses anything above the abuse cap.
 * Black Friday does not reduce it. The row stays `pending` until the webhook
 * marks it live, so it cannot appear on the public board by itself.
 *
 * Guest claim: this route does not require a session. Directory submit stays gated.
 */

import { campaignSnapshot } from '~~/shared/content/campaign'
import { billboardBidDraft, BILLBOARD_FLOOR_CENTS } from '~~/shared/utils/billboard-bid'
import { centsLabel } from '~~/shared/content/campaign'
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
    url?: unknown
    email?: unknown
    name?: unknown
    tagline?: unknown
    amount_cents?: unknown
  }>(event).catch(() => null)) ?? {}

  const draft = billboardBidDraft({
    url: String(body.url ?? ''),
    email: String(body.email ?? ''),
    name: String(body.name ?? ''),
    amountCents: body.amount_cents,
  })
  if (!draft) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        reason: 'bad_checkout',
        message_en: 'Send a real http(s) URL, an email, and a whole-dollar amount from $15.',
        message_zh: '请填写有效的 http(s) 网址、邮箱，以及从 $15 起的整数美元金额。',
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
        message_en: 'Card payment is not switched on yet — request an invoice instead.',
        message_zh: '在线支付还没开通，请改为索取发票。',
      },
    })
  }

  const amountCents = draft.amountCents
  const db = await useDb(event)
  const config = paymentConfig(event)
  const orderId = newOrderId()
  const urls = returnUrls(event, orderId)
  const placementId = newBillboardId()
  const tagline = String(body.tagline ?? '').trim().slice(0, 140)

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
    name: draft.name,
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
      description: `Billboard ${centsLabel(amountCents)} — ${draft.url}`,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
    })
    await attachSession(db, orderId, session.ref, session.url)
    return {
      ok: true,
      order: orderId,
      url: session.url,
      amount_cents: amountCents,
      floor_cents: BILLBOARD_FLOOR_CENTS,
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
