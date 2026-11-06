/**
 * GET /api/admin/users/:id — one user's profile, roles and totals.
 *
 * Source `server/admin/handlers/users-id.ts` reads a `user` table plus the
 * `order` / `credit` ledgers. None of those exist here (see
 * `server/utils/admin-users.ts`), so the profile is derived from the activity
 * this site actually records and every total is the source's zero value. The
 * two ledgers themselves come from `/api/admin/orders` and `/api/admin/credits`
 * filtered by `userId`, which answer empty for the same reason.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { getAdminUser } from '../../../utils/admin-users'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  const db = await useDb(event)
  const detail = await getAdminUser(db, id)

  if (!detail) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      data: {
        message_en: 'User not found',
        message_zh: '用户不存在',
      },
    })
  }

  return { ok: true, ...detail }
})
