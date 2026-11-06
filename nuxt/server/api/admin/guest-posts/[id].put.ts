/**
 * PUT /api/admin/guest-posts/:id — save the reviewer's edits.
 *
 * Refuses: no submission store, and the post body belongs to a `post` table
 * this build does not have (`/blog` renders source files). The editor stays
 * because the panel is the source's.
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
      message_en: 'This build has no submission store, so the edit has nowhere to go.',
      message_zh: '本站没有投稿数据表，修改没有可以保存的地方。',
    },
  })
})
