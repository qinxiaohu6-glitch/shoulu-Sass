/**
 * POST /api/admin/directory/tools — create one listing.
 *
 * Body is the source's `toPayload`, including `tagIds` (tag slugs) which are
 * translated back into the English labels `dir_tool.tags` stores.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { createAdminTool, tagSlugError } from '../../../utils/admin-directory'
import { slugify } from '../../../../shared/utils/catalog'

function readInput(body: Record<string, unknown>) {
  const str = (key: string) => String(body?.[key] ?? '').trim()
  return {
    slug: (str('slug') || slugify(str('name'))).toLowerCase(),
    name: str('name'),
    tagline: str('tagline'),
    introduction: str('introduction'),
    nameZh: str('nameZh'),
    taglineZh: str('taglineZh'),
    introductionZh: str('introductionZh'),
    websiteUrl: str('websiteUrl'),
    iconUrl: str('iconUrl'),
    pricing: str('pricing') || 'free',
    authorName: str('authorName'),
    categoryId: str('categoryId'),
    source: str('source') === 'community' ? 'community' : 'editorial',
    status: str('status') || 'published',
    featured: Boolean(body?.featured),
    sponsored: Boolean(body?.sponsored),
    sort: Number(body?.sort) || 0,
    tagIds: Array.isArray(body?.tagIds) ? (body.tagIds as unknown[]).map(String).filter(Boolean) : [],
  }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event)) as Record<string, unknown>
  const input = readInput(body)

  if (!input.name) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: 'name is required', message_zh: '名称不能为空' },
    })
  }

  const invalid = tagSlugError(input.slug)
  if (invalid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: invalid, message_zh: 'Slug 只能用小写字母、数字和横线' },
    })
  }

  const db = await useDb(event)
  try {
    return { ok: true, ...(await createAdminTool(db, input)) }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: (error as Error).message, message_zh: '保存失败，请检查填写内容' },
    })
  }
})
