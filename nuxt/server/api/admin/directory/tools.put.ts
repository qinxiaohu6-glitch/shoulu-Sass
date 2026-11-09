/**
 * PUT /api/admin/directory/tools — update one listing.
 *
 * Three bodies reach this route, all from the source page:
 *
 *   `{id, forceUnpublish: true}`  take it off the site and mark it rejected
 *   `{id, status}`                approve / reject from the row actions
 *   `{id, …fields}`               the edit drawer (source and status stay locked)
 *
 * The `forceUnpublish` branch is checked first because it is the only one that
 * must not fall through into a full write.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { saveAdminListing, setAdminToolStatus } from '../../../utils/admin-directory'

function readInput(body: Record<string, unknown>) {
  const str = (key: string) => String(body?.[key] ?? '').trim()
  return {
    slug: str('id'),
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
  const id = String(body?.id ?? '').trim()
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: 'ID is required', message_zh: '缺少 ID' },
    })
  }

  const db = await useDb(event)

  try {
    if (body?.forceUnpublish === true) {
      return { ok: true, ...(await setAdminToolStatus(db, id, 'rejected')) }
    }

    // A body with an id and a status and nothing else is the row action; the
    // edit drawer always sends `name`.
    if (typeof body?.status === 'string' && body.name === undefined) {
      return { ok: true, ...(await setAdminToolStatus(db, id, body.status)) }
    }

    return { ok: true, ...(await saveAdminListing(db, id, readInput(body))) }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: (error as Error).message, message_zh: '保存失败，请检查填写内容' },
    })
  }
})
