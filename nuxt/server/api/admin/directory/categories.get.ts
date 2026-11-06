/**
 * GET /api/admin/directory/categories — the console's category list.
 *
 * Drafts are included (they are rows an operator still has to publish); the
 * `deleted` tombstones `hideCategory` writes are not.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { listAdminCategories, listAdminCategoryOptions } from '../../../utils/admin-directory'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)
  const db = await useDb(event)

  // `?all=true` is the tool form's category select: every category, no paging.
  if (query.all === 'true') {
    return { ok: true, items: await listAdminCategoryOptions(db) }
  }

  const { items, total } = await listAdminCategories(db, {
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    search: typeof query.search === 'string' ? query.search : undefined,
  })

  return { ok: true, items, total }
})
