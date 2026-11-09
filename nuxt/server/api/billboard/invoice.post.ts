/**
 * POST /api/billboard/invoice — store a Billboard bid as an invoice request.
 *
 * The row is always `requested` with no confirmed timestamp, so the public
 * board cannot show it. This route does not open a charge session.
 * Guest claim: no session is required. Directory submit stays gated.
 */

import { billboardBidDraft } from '~~/shared/utils/billboard-bid'
import { insertBillboardRequest } from '../../utils/billboard'
import { useDb } from '../../utils/db'

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
        reason: 'bad_invoice',
        message_en: 'Send a real http(s) URL, an email, and a whole-dollar amount from $15.',
        message_zh: '请填写有效的 http(s) 网址、邮箱，以及从 $15 起的整数美元金额。',
      },
    })
  }

  try {
    const db = await useDb(event)
    const id = newBillboardId()
    await insertBillboardRequest(db, {
      id,
      tier: draft.tier,
      name: draft.name,
      tagline: String(body.tagline ?? '').trim().slice(0, 140),
      url: draft.url,
      email: draft.email,
      amountCents: draft.amountCents,
      now: Math.floor(Date.now() / 1000),
    })
    return {
      ok: true as const,
      id,
      status: draft.status,
      amount_cents: draft.amountCents,
      published: draft.published,
    }
  } catch (err) {
    console.error('[billboard] invoice insert failed', err)
    throw createError({ statusCode: 503, statusMessage: 'Could not store the invoice request' })
  }
})