/**
 * PATCH /api/admin/agent/accounts — rename an agent / change its roles.
 *
 * Refuses: there is no agent row to update (see `accounts.get.ts`). The edit
 * dialog stays because the page is the source's; saving says why nothing
 * changed.
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
      message_en: 'This build has no agent accounts, so there is nothing to update.',
      message_zh: '本站没有 Agent 账号，没有可以修改的记录。',
    },
  })
})
