/**
 * DELETE /api/admin/permissions?id= — remove a permission.
 *
 * Nothing to remove: see `index.post.ts` in this folder.
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
      message_en: 'This build checks no per-permission rules, so there is nothing to delete.',
      message_zh: '本站不按权限码校验，没有可以删除的权限。',
    },
  })
})
