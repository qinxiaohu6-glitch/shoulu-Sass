/**
 * POST /api/admin/ads — book, edit, or pull a weekly placement.
 *
 * Three actions because there are three things an operator does with an order:
 * `create` when the money arrives, `update` to fix a typo or extend the window,
 * `stop` to take it down now. `stop` keeps the row — the invoice was written
 * from these dates, and deleting the record would leave nothing to check it
 * against.
 */

import { isAdmin } from '../../utils/admin'
import { useDb } from '../../utils/db'
import { AdError, createAd, stopAd, updateAd } from '../../utils/ads'

const STATUS: Record<string, number> = {
  bad_payload: 400,
  bad_slot: 400,
  bad_date: 400,
  bad_url: 400,
  too_short: 400,
  too_long: 400,
  end_before_start: 400,
  bad_action: 400,
  not_found: 404,
}

const COPY: Record<string, { zh: string; en: string }> = {
  bad_slot: { zh: '广告位只能是榜单位或侧栏位。', en: 'Slot must be board or sidebar.' },
  bad_date: { zh: '日期格式应为 YYYY-MM-DD。', en: 'Dates must be YYYY-MM-DD.' },
  end_before_start: { zh: '结束日期不能早于开始日期。', en: 'End date cannot precede the start date.' },
  bad_url: { zh: '链接必须是完整的 http(s) 地址。', en: 'The link must be a full http(s) URL.' },
  too_short: { zh: '填写得太短了。', en: 'That is too short.' },
  too_long: { zh: '填写得太长了。', en: 'That is too long.' },
  not_found: { zh: '找不到这条广告。', en: 'No such placement.' },
  bad_action: { zh: '未知的操作。', en: 'Unknown action.' },
  bad_payload: { zh: '请求格式不对。', en: 'Bad request.' },
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'bad_payload', message_zh: COPY.bad_payload!.zh, message_en: COPY.bad_payload!.en }
  }

  const action = String(body.action ?? 'create').trim()
  const id = String(body.id ?? '').trim()
  const db = await useDb(event)

  try {
    if (action === 'create') return { ok: true, item: await createAd(db, body) }
    if (action === 'update') {
      if (!id) throw new AdError('not_found')
      return { ok: true, item: await updateAd(db, id, body) }
    }
    if (action === 'stop') {
      if (!id) throw new AdError('not_found')
      return { ok: true, item: await stopAd(db, id) }
    }
    throw new AdError('bad_action')
  } catch (err) {
    if (err instanceof AdError) {
      const copy = COPY[err.code] ?? COPY.bad_payload!
      setResponseStatus(event, STATUS[err.code] ?? 400)
      return {
        ok: false,
        reason: err.code,
        field: err.field ?? null,
        message_zh: copy.zh,
        message_en: copy.en,
      }
    }
    console.error('[admin/ads]', err)
    setResponseStatus(event, 500)
    return { ok: false, reason: 'internal_error' }
  }
})
