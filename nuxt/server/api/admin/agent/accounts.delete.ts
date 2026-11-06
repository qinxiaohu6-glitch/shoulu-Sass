/**
 * DELETE /api/admin/agent/accounts?id= — remove an agent, its role assignments
 * and its keys.
 *
 * Refuses: there is no agent row to remove (see `accounts.get.ts`). The delete
 * confirmation stays because the page is the source's; confirming says why
 * nothing was removed.
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
      message_en: 'This build has no agent accounts, so there is nothing to delete.',
      message_zh: '本站没有 Agent 账号，没有可以删除的记录。',
    },
  })
})
