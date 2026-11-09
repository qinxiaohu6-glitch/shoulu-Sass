/**
 * DELETE /api/admin/directory/categories?id=… — hide one category.
 *
 * Refused while listings still point at it, which is the source's rule and the
 * reason the console hides the trash icon on a non-empty row.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { deleteAdminCategory } from '../../../utils/admin-directory'

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
    return { ok: true, ...(await deleteAdminCategory(db, id)) }
  } catch (error) {
    const message = (error as Error).message
    const builtin = /catalogue|built-in/i.test(message)
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        message_en: message,
        message_zh: builtin
          ? '这是前台正在用的内置分类，不能删除。可以直接改名称和图标。'
          : '该分类下仍有关联工具，请先把它们改到其他分类再删除。',
      },
    })
  }
})
