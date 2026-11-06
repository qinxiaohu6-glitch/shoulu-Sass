/**
 * GET /api/admin/users — the console's user list.
 *
 * There is no user table in this build, so a row is one distinct Google `sub`
 * that has submitted a listing or opened a ticket — the same headcount the
 * overview card reports. See `server/utils/admin-users.ts` for the four columns
 * that have no source and therefore always render their empty value.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { listAdminUsers } from '../../../utils/admin-users'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)
  const db = await useDb(event)

  const { items, total } = await listAdminUsers(db, {
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    search: typeof query.search === 'string' ? query.search : undefined,
  })

  return { ok: true, items, total }
})
