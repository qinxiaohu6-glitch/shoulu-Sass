/**
 * DELETE /api/admin/directory/tools?id=… — remove one listing.
 *
 * Only an unpublished listing can go, which is the source's rule and the reason
 * the trash icon only appears on pending / awaiting-payment / rejected rows. A
 * published one has to be force-unpublished first, so the destructive path is
 * always two deliberate clicks.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { deleteAdminTool } from '../../../utils/admin-directory'

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
    return { ok: true, ...(await deleteAdminTool(db, id)) }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: (error as Error).message, message_zh: '删除失败：仅未发布的工具可删除，请先强制下架' },
    })
  }
})
