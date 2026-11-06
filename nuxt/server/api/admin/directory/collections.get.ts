/**
 * GET /api/admin/directory/collections — the console's collection list.
 *
 * Each row carries its member tool slugs in order (`toolIds`), which is what the
 * manage-tools drawer reorders and writes back.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { listAdminCollections } from '../../../utils/admin-directory'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)
  const db = await useDb(event)

  const { items, total } = await listAdminCollections(db, {
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    search: typeof query.search === 'string' ? query.search : undefined,
  })

  return { ok: true, items, total }
})
