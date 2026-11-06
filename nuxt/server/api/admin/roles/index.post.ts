/**
 * POST /api/admin/roles — create a role.
 *
 * There is no roles table and no per-permission gate: `/admin` is a single
 * token (`server/utils/admin.ts`), so a role would grant nothing to anyone. The
 * page is the source's; the write says so instead of storing a dead row.
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
      message_en: 'This build gates /admin with a single token, so there is no roles table to write to.',
      message_zh: '本站后台由单一 token 控制，没有角色表可以写入。',
    },
  })
})
