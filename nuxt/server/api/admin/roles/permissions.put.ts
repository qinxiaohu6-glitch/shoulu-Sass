/**
 * PUT /api/admin/roles/permissions — replace a role's permission set.
 *
 * No roles, no permissions, no assignments: see `index.post.ts` in this folder.
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
      message_en: 'This build has no roles or permissions to assign.',
      message_zh: '本站没有角色和权限可以分配。',
    },
  })
})
