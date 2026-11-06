/**
 * GET /api/admin/directory/ads — the console's sponsor-placement list.
 *
 * Paged, tab-filtered by status and searchable on name / URL, which is what
 * `admin.directory.ads` renders. Reads through `listAdminAds`, which maps this
 * build's weekly-placement row onto the source page's vocabulary — see the
 * header of that section for the four fields that differ.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { listAdminAds } from '../../../utils/admin-directory'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)
  const db = await useDb(event)

  const { items, total } = await listAdminAds(db, {
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    search: typeof query.search === 'string' ? query.search : undefined,
    status: typeof query.status === 'string' ? query.status : undefined,
  })

  return { ok: true, items, total }
})
