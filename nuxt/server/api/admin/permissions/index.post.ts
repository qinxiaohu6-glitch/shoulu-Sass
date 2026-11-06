/**
 * POST /api/admin/permissions — define a permission.
 *
 * This build has no permission catalogue and no capability checks (the console
 * is gated by one token), so a row here would describe a rule nothing enforces.
 * The page is the source's; saving says so instead of storing one.
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
      message_en: 'This build checks no per-permission rules, so there is nowhere to store one.',
      message_zh: '本站不按权限码校验，没有可以保存权限的地方。',
    },
  })
})
