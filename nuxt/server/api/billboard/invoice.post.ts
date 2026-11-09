/**
 * POST /api/billboard/invoice — store a Billboard intent.
 *
 * The row is always `requested` with no confirmed timestamp, so the public
 * board cannot show it. This route does not open a charge session.
 */

import { billboardInvoiceDraft } from '~~/shared/utils/billboard'
import { insertBillboardRequest } from '../../utils/billboard'
import { useDb } from '../../utils/db'

function newBillboardId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return `bb_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const body = (await readBody<{ tier?: unknown; url?: unknown; email?: unknown; name?: unknown }>(event).catch(
    () => null,
  )) ?? {}

  const draft = billboardInvoiceDraft({
    tier: String(body.tier ?? ''),
    url: String(body.url ?? ''),
    email: String(body.email ?? ''),
    name: String(body.name ?? ''),
  })
  if (!draft) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        reason: 'bad_invoice',
        message_en: 'Send a real http(s) URL, an email, and Entry, Standard or Prime.',
        message_zh: '请填写有效的 http(s) 网址、邮箱，以及入门、标准或优先档。',
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
      url: draft.url,
      email: draft.email,
      now: Math.floor(Date.now() / 1000),
    })
    return {
      ok: true as const,
      id,
      status: draft.status,
      published: draft.published,
    }
  } catch (err) {
    console.error('[billboard] invoice insert failed', err)
    throw createError({ statusCode: 503, statusMessage: 'Could not store the invoice request' })
  }
})
