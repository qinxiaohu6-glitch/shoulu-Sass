/**
 * DELETE /api/admin/agent/keys?id= — revoke an agent's key.
 *
 * Refuses: no key was ever issued, so there is nothing to revoke
 * (see `keys.post.ts`). The revoke button stays because the page is the
 * source's; confirming says why nothing changed.
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
      message_en: 'This build issues no agent keys, so there is nothing to revoke.',
      message_zh: '本站不签发 Agent 密钥，没有可以吊销的密钥。',
    },
  })
})
