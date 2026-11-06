/**
 * POST /api/admin/directory/collections — create one collection.
 *
 * Body is the source's `toPayload`: `{slug, name, description, nameZh,
 * descriptionZh, icon, coverUrl, sort, status}`. Membership is not part of the
 * create form — a new collection starts empty and is filled from the
 * manage-tools drawer.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { createAdminCollection, tagSlugError } from '../../../utils/admin-directory'
import { slugify } from '../../../../shared/utils/catalog'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event)) as Record<string, unknown>
  const str = (key: string) => String(body?.[key] ?? '').trim()

  const name = str('name')
  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: 'name is required', message_zh: '名称不能为空' },
    })
  }

  const slug = (str('slug') || slugify(name)).toLowerCase()
  const invalid = tagSlugError(slug)
  if (invalid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: invalid, message_zh: 'Slug 只能用小写字母、数字和横线' },
    })
  }

  const db = await useDb(event)
  try {
    return {
      ok: true,
      ...(await createAdminCollection(db, {
        slug,
        name,
        description: str('description'),
        nameZh: str('nameZh'),
        descriptionZh: str('descriptionZh'),
        icon: str('icon'),
        coverUrl: str('coverUrl'),
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
