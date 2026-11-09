/**
 * POST /api/payments/ad-checkout — rent a weekly placement.
 *
 * Deliberately separate from `/api/payments/checkout`: that one charges for a
 * *submission*, this one charges for a *date range*. There is no submission
 * behind an ad, so the order row carries `submission_id = ''`, `plan = 'ad'`
 * and the booking details live in `ad_booking` keyed by the same order id.
 * Everything downstream — signature check, amount check, exactly-once settle,
 * refunds — is the same path the listings use.
 *
 * The request names a slot, a length, a start Monday and the creative. It does
 * NOT name a price: `adPriceCents()` decides that from the pricing table, and
 * `isBookableMonday()` rejects any start the server did not offer. A client
 * that can name its own price or week is neither a price nor a schedule.
 *
 * Order of operations matches listing checkout: the rows are written before
 * the provider is called, so a timeout leaves evidence of the attempt.
 */

import { useDb } from '../../utils/db'
import { AdError, isAdSlot, validate } from '../../utils/ads'
import {
  bookingWindow,
  createAdBooking,
  isBookableMonday,
  setAdBookingStatus,
  slotConflict,
} from '../../utils/ad-bookings'
import { getPaymentProvider, paymentConfig, returnUrls } from '../../utils/payments'
import { attachSession, createOrder, newOrderId, setOrderStatus } from '../../utils/payments/orders'
import { campaignSnapshot } from '~~/shared/content/campaign'
import { AD_WEEK_OPTIONS, adPlans } from '~~/shared/content/pricing'
import { effectiveAmountCents, listAmountCents } from '~~/shared/utils/pricing-effective'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Body = {
  slot?: unknown
  weeks?: unknown
  start?: unknown
  email?: unknown
  name?: unknown
  headline?: unknown
  url?: unknown
  logo?: unknown
}

function badRequest(reason: string, field = '', message = ''): never {
  throw createError({
    statusCode: 400,
    statusMessage: 'Bad Request',
    data: {
      reason,
      field,
      message_en: message || `Invalid ${field || 'request'}.`,
      message_zh: message || '请求参数不正确。',
    },
  })
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const slot = String(body.slot ?? '').trim().toLowerCase()

  // Weekly board rental is retired. Refuse before a provider session exists,
  // so this path cannot charge $29 for a week or pretend checkout succeeded.
  if (slot === 'board') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: {
        reason: 'board_retired',
        message_en:
          'The weekly board slot is no longer sold. Billboard is a one-time placement — pay on /billboard and it goes live when payment succeeds.',
        message_zh: '榜单周租已停售。Billboard 改为一次性档位，请到 /billboard 付款，付款成功后自动上板。',
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
        message_en: 'Online booking is not switched on yet — contact us to reserve a week.',
        message_zh: '在线预订还没开通，请联系我们人工排期。',
      },
    })
  }

  if (!isAdSlot(slot)) badRequest('bad_slot', 'slot')

  const weeks = Number(body.weeks)
  if (!(AD_WEEK_OPTIONS as readonly number[]).includes(weeks)) badRequest('bad_weeks', 'weeks')

  const start = String(body.start ?? '').trim()
  if (!isBookableMonday(start)) badRequest('bad_start', 'start')

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 160) badRequest('bad_email', 'email')

  const { end } = bookingWindow(start, weeks)
  const amountCents = effectiveAmountCents('sidebar', String(weeks))
  const listCents = listAmountCents('sidebar', String(weeks))
  if (!amountCents) badRequest('bad_price')

  // Reuses the operator console's own validation: real dates, a window that
  // is not inverted, an http(s) target, and bounded creative text. A
  // `javascript:` URL on the homepage is an XSS payload with a budget.
  let creative
  try {
    creative = validate({ slot, name: body.name, headline: body.headline, url: body.url, logo: body.logo, start, end })
  } catch (err) {
    if (err instanceof AdError) badRequest(err.code, err.field ?? '')
    throw err
  }

  const db = await useDb(event)
  if (await slotConflict(db, slot, start, end, { email })) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: {
        reason: 'slot_taken',
        message_en: 'That week is already booked. Pick another week or the other position.',
        message_zh: '这一周已经订出去了，换一周或选另一个位置。',
      },
    })
  }

  const config = paymentConfig(event)
  const orderId = newOrderId()
  const urls = returnUrls(event, orderId)
  const label = adPlans.find((plan) => plan.id === slot)?.name.en ?? slot

  await createOrder(db, {
    id: orderId,
    submissionId: '',
    plan: 'ad',
    amountCents,
    currency: config.currency,
    provider: provider.id,
    buyerEmail: email,
  })
  await createAdBooking(db, {
    orderId,
    slot,
    weeks,
    start,
    end,
    name: creative.name,
    headline: creative.headline,
    url: creative.url,
    logo: creative.logo,
    email,
    amountCents,
  })

  try {
    const session = await provider.createCheckout({
      orderId,
      submissionId: '',
      plan: 'ad',
      amountCents,
      currency: config.currency,
      email,
      description: `${label} — ${start} to ${end} (${weeks} week${weeks > 1 ? 's' : ''})`,
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
    }
  } catch (err) {
    console.error('[payments] ad checkout failed', err)
    await setOrderStatus(db, orderId, 'failed', {
      note: err instanceof Error ? err.message.slice(0, 200) : 'provider_error',
    })
    await setAdBookingStatus(db, orderId, 'cancelled')
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
