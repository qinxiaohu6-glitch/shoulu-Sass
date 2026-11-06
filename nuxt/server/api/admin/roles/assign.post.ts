/**
 * POST /api/admin/roles/assign — give a user a role.
 *
 * No roles table exists in this build (see `GET /api/admin/roles`), so there is
 * no row to write. The dialog reports the gap rather than claiming success.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Bad Request',
    data: {
      message_en: 'This build has no roles table — the console is gated by one token, so there is nothing to assign.',
      message_zh: '本站没有角色表：后台由单一令牌控制，没有可分配的角色。',
    },
  })
})
