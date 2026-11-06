/**
 * DELETE /api/admin/directory/ads?id=… — remove one sponsor placement.
 *
 * A live placement cannot be deleted: it is holding an inventory seat that a
 * payment is attached to. Take it down first (`PUT {forceExpire:true}`), then
 * delete — the same two deliberate steps the source enforces, and the reason
 * the trash icon only appears on expired rows.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { deleteAdminAd } from '../../../utils/admin-directory'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const id = String(getQuery(event).id ?? '').trim()
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: 'ID is required', message_zh: '缺少 ID' },
    })
  }

  const db = await useDb(event)
  try {
    return { ok: true, ...(await deleteAdminAd(db, id)) }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: (error as Error).message, message_zh: '删除失败：生效中的广告请先强制下架' },
    })
  }
})
