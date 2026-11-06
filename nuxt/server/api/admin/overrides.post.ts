/**
 * POST /api/admin/overrides — pin or hide one curated listing.
 *
 * The console sends `{ slug, key, value, until }`. `until` only means something
 * for `pin`; a pin with no end date runs until it is switched off.
 */

import { isAdmin } from '../../utils/admin'
import { useDb } from '../../utils/db'
import { OverrideError, loadOverrides, setOverride } from '../../utils/overrides'

const COPY: Record<string, { status: number; zh: string; en: string }> = {
  bad_slug: { status: 400, zh: '产品标识不合法。', en: 'Unknown product slug.' },
  bad_key: { status: 400, zh: '未知的开关。', en: 'Unknown switch.' },
  bad_date: { status: 400, zh: '日期格式应为 YYYY-MM-DD。', en: 'Dates must be YYYY-MM-DD.' },
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'bad_key' }
  }

  const slug = String(body.slug ?? '').trim()
  const key = String(body.key ?? '').trim()
  const value = Boolean(body.value)
  const until = String(body.until ?? '').trim()

  const db = await useDb(event)
  try {
    const row = await setOverride(db, slug, key as 'pin' | 'hidden', value, until)
    // The whole state comes back so the console can hand it straight to
    // `useOverrides()` — one request leaves the panel and the site agreeing,
    // instead of the panel changing while the pages it controls still show the
    // old answer until a reload.
    return { ok: true, row, state: await loadOverrides(db) }
  } catch (err) {
    if (err instanceof OverrideError) {
      const copy = COPY[err.code] ?? COPY.bad_key!
      setResponseStatus(event, copy.status)
      return { ok: false, reason: err.code, message_zh: copy.zh, message_en: copy.en }
    }
    console.error('[admin/overrides]', err)
    setResponseStatus(event, 500)
    return { ok: false, reason: 'internal_error' }
  }
})
