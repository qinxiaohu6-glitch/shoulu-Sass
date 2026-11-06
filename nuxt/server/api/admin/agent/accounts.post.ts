/**
 * POST /api/admin/agent/accounts — create an agent service account.
 *
 * Refuses: an agent is an `api`-type user whose permissions are its RBAC roles,
 * and this build has neither a users table nor a roles table — `/admin` is
 * gated by a single owner token. The dialog stays because the page is the
 * source's; submitting says why nothing was created.
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
      message_en: 'This build has no agent accounts: /admin is gated by a single owner token, and there is no users or roles table for an agent to hold.',
      message_zh: '本站没有 Agent 账号：/admin 由单一站长令牌控制，也没有可以给 Agent 分配角色的用户表和角色表。',
    },
  })
})
