/**
 * POST /api/payments/checkout — start paying for one submission.
 *
 * The request carries a submission id and nothing else. Plan, amount, currency
 * and description are all read server-side: a client that can name its own
 * price is not a price, and this endpoint is reachable by anyone.
 *
 * Order of operations matters. The row is written *before* the provider is
 * called, so a provider timeout leaves evidence of the attempt instead of a
 * session that exists upstream and nowhere else. If the call fails the row is
 * marked `failed` and the submitter keeps the manual instructions.
 */

import { getSubmission } from '../../utils/submissions'
import { useDb } from '../../utils/db'
import { planAmountCents } from '~~/shared/content/pricing'
import { getPaymentProvider, paymentConfig, returnUrls } from '../../utils/payments'
import { attachSession, createOrder, newOrderId, setOrderStatus } from '../../utils/payments/orders'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const provider = getPaymentProvider(event)
  if (!provider) {
    // Not an error the caller caused. The console shows the manual flow in
    // this case; the status code only matters to a client that ignored
    // /api/payments/config.
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

  const body = (await readBody(event).catch(() => null)) as { submission_id?: string } | null
  const submissionId = String(body?.submission_id || '').trim()
  if (!submissionId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  const db = await useDb(event)
  const submission = await getSubmission(db, submissionId)
  if (!submission) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  if (submission.paid_at) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: {
        reason: 'already_paid',
        message_en: 'This submission is already paid for.',
        message_zh: '这条提交已经付过款了。',
      },
    })
  }

  const amountCents = planAmountCents(submission.plan)
  if (!amountCents) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: {
        reason: 'nothing_to_pay',
        message_en: 'This submission has no fee to pay.',
        message_zh: '这条提交没有需要支付的费用。',
      },
    })
  }

  const config = paymentConfig(event)
  const orderId = newOrderId()
  const urls = returnUrls(event, orderId)

  await createOrder(db, {
    id: orderId,
    submissionId: submission.id,
    plan: submission.plan,
    amountCents,
    currency: config.currency,
    provider: provider.id,
    buyerEmail: submission.email,
  })

  try {
    const session = await provider.createCheckout({
      orderId,
      submissionId: submission.id,
      plan: submission.plan,
      amountCents,
      currency: config.currency,
      email: submission.email,
      description: `${submission.name} — directory listing`,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
    })
    await attachSession(db, orderId, session.ref, session.url)
    return { ok: true, order: orderId, url: session.url }
  } catch (err) {
    console.error('[payments] checkout failed', err)
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
