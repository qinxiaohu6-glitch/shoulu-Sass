/**
 * PUT /api/admin/directory/categories — update one category.
 *
 * The slug is the id and is never rewritten: it is the public category URL and
 * the value every listing stores in `dir_tool.category`.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { updateAdminCategory } from '../../../utils/admin-directory'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event)) as Record<string, unknown>
  const str = (key: string) => String(body?.[key] ?? '').trim()

  const id = str('id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: 'ID is required', message_zh: '缺少 ID' },
    })
  }

  const db = await useDb(event)
  try {
    return {
      ok: true,
      ...(await updateAdminCategory(db, id, {
        name: str('name'),
        description: str('description'),
        nameZh: str('nameZh'),
        descriptionZh: str('descriptionZh'),
        icon: str('icon'),
        sort: Number(body?.sort) || 0,
        status: str('status') === 'draft' ? 'draft' : 'published',
      })),
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: (error as Error).message, message_zh: '保存失败，请检查填写内容' },
    })
  }
})
