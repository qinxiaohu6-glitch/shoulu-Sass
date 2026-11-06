/**
 * PUT /api/admin/directory/tags — update one tag.
 *
 * The slug is the id and is never rewritten: public tag URLs and every listing
 * that carries the label would break, which is the same reason the source locks
 * the field on edit (`admin.directory.common.slug_locked_hint`).
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { updateAdminTag } from '../../../utils/admin-directory'

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
      ...(await updateAdminTag(db, id, {
        name: str('name'),
        description: str('description'),
        nameZh: str('nameZh'),
        descriptionZh: str('descriptionZh'),
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
