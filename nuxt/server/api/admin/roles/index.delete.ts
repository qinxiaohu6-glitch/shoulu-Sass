/**
 * DELETE /api/admin/roles?id= — delete a role.
 *
 * Nothing to delete: see `index.post.ts` in this folder.
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
      message_en: 'This build gates /admin with a single token, so there is no roles table to delete from.',
      message_zh: '本站后台由单一 token 控制，没有角色表可以删除。',
    },
  })
})
