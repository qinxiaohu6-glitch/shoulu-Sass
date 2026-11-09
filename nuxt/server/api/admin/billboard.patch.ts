/**
 * PATCH /api/admin/billboard — take a placement down, or fulfil one by hand
 * when a paid webhook never arrived. This does not create a charge.
 */

import { isAdmin } from '../../utils/admin'
import { billboardMediaPatch, setBillboardMedia } from '../../utils/billboard'
import { captureBillboardScreenshot } from '../../utils/billboard-media'
import { setBillboardStatus } from '../../utils/billboard-fulfilment'
import { useDb } from '../../utils/db'

type Body = {
  id?: unknown
  action?: unknown
  note?: unknown
  screenshot?: unknown
  logo?: unknown
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = ((await readBody<Body>(event).catch(() => null)) ?? {}) as Body
  const id = String(body.id ?? '').trim()
  const action = String(body.action ?? '').trim()
  const note = String(body.note ?? '').trim().slice(0, 300)
  if (!id || (action !== 'remove' && action !== 'fulfill' && action !== 'media' && action !== 'capture')) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  const db = await useDb(event)
  const existing = await db
    .prepare(`SELECT id FROM billboard_placement WHERE id = ?`)
    .bind(id)
    .first<{ id: string }>()
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  if (action === 'media') {
    const media = billboardMediaPatch(body.screenshot, body.logo)
    if (!media) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        data: {
          message_zh: '截图请填 https 图片地址，或 public/assets/img/screenshots 下的文件名。Logo 只能是 http(s) 地址。',
          message_en: 'Screenshot must be an https image URL or a filename under public/assets/img/screenshots. Logo must be an http(s) URL.',
        },
      })
    }
    await setBillboardMedia(db, id, media)
    return { ok: true as const, id, action, screenshot: media.screenshot, logo: media.logo }
  }

  if (action === 'capture') {
    const screenshot = await captureBillboardScreenshot(db, id)
    return { ok: true as const, id, action, screenshot, found: Boolean(screenshot) }
  }

  if (action === 'remove') {
    await setBillboardStatus(db, id, 'removed', { note: note || '后台下架' })
  } else {
    await setBillboardStatus(db, id, 'live', { note: note || '后台手动补发' })
  }
  return { ok: true as const, id, action }
})
