/**
 * GET /api/admin/directory/tools — the console's tool list.
 *
 * Three shapes, all from the source page:
 *   `?id=<slug>`   the edit drawer's detail payload (translations + tag slugs)
 *   `?all=true`    the collection drawer's picker: `{id, slug, name}`, no paging
 *   otherwise      a paged, tab-filtered, searchable page of rows
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { getAdminToolDetail, listAdminTools, listToolOptions } from '../../../utils/admin-directory'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)
  const db = await useDb(event)

  const id = typeof query.id === 'string' ? query.id.trim() : ''
  if (id) {
    const detail = await getAdminToolDetail(db, id)
    if (!detail) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found',
        data: { message_en: 'Tool not found', message_zh: '工具不存在' },
      })
    }
    return { ok: true, ...detail }
  }

  if (query.all === 'true') {
    return { ok: true, items: await listToolOptions(db) }
  }

  const { items, total } = await listAdminTools(db, {
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    search: typeof query.search === 'string' ? query.search : undefined,
    status: typeof query.status === 'string' ? query.status : undefined,
  })

  return { ok: true, items, total }
})
