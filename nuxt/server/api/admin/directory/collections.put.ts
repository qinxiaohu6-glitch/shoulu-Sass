/**
 * PUT /api/admin/directory/collections — update one collection.
 *
 * Two shapes reach this route, both from the source:
 *
 *  - `{id, …fields}` — the edit drawer's `toEditPayload`, which carries no
 *    membership and must not clear it.
 *  - `{id, toolIds}` — the manage-tools drawer, which rewrites the ordered
 *    member list and nothing else.
 *
 * The presence of `toolIds` is what tells them apart. Everything else about the
 * row is left alone in the second case, because a reorder must not republish a
 * draft or blank its copy.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { setCollectionTools, updateAdminCollection } from '../../../utils/admin-directory'

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
    if (Array.isArray(body?.toolIds)) {
      const toolIds = (body.toolIds as unknown[]).map((value) => String(value)).filter(Boolean)
      return { ok: true, ...(await setCollectionTools(db, id, toolIds)) }
    }

    return {
      ok: true,
      ...(await updateAdminCollection(db, id, {
        name: str('name'),
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
