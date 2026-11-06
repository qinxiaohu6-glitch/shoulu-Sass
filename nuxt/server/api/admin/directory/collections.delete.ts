/**
 * DELETE /api/admin/directory/collections?id=… — remove one collection.
 *
 * The rows really go: a collection has no catalogue fallback, so unlike a
 * category or a tag there is nothing to resurrect it. Member links go first,
 * because D1 does not guarantee `ON DELETE CASCADE`.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { deleteAdminCollection } from '../../../utils/admin-directory'

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
    return { ok: true, ...(await deleteAdminCollection(db, id)) }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: (error as Error).message, message_zh: '删除失败' },
    })
  }
})
