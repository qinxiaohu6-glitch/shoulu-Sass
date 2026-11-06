/**
 * PUT /api/admin/permissions — update a permission.
 *
 * Nothing to update: see `index.post.ts` in this folder.
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
      message_en: 'This build checks no per-permission rules, so there is nothing to update.',
      message_zh: '本站不按权限码校验，没有可以更新的权限。',
    },
  })
})
