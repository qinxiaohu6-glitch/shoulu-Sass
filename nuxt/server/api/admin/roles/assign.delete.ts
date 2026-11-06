/**
 * DELETE /api/admin/roles/assign?userId=…&roleId=… — take a role away.
 *
 * Same gap as the POST: no roles table, so no row to delete.
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
      message_en: 'This build has no roles table — the console is gated by one token, so there is nothing to remove.',
      message_zh: '本站没有角色表：后台由单一令牌控制，没有可移除的角色。',
    },
  })
})
