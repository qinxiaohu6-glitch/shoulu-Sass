/**
 * POST /api/admin/agent/keys — issue an admin API key for an agent.
 *
 * Refuses: a key is only useful against the source's admin API surface
 * (`/api/admin/agent/mcp` and the skill endpoints), which this build does not
 * serve — `/admin` is gated by the owner token instead. The form stays because
 * the page is the source's; issuing says why no key was created.
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
      message_en: 'This build serves no agent API, so a key would have nothing to call. /admin is gated by the owner token.',
      message_zh: '本站没有 Agent API，签发的密钥没有可以调用的接口。/admin 由站长令牌控制。',
    },
  })
})
