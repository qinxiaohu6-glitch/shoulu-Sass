/**
 * DELETE /api/admin/invite-codes?id= — remove a code.
 *
 * Nothing was ever stored (see the GET route), so there is nothing to remove.
 * The confirm dialog still runs and reports this instead of closing silently.
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
      message_en: 'There is no invite-code store in this build, so there is nothing to delete.',
      message_zh: '本站没有邀请码存储，没有可以删除的记录。',
    },
  })
})
