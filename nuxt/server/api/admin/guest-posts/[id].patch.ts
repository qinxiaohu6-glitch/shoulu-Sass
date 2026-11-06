/**
 * PATCH /api/admin/guest-posts/:id — unpublish.
 *
 * Refuses: there is no submission store, and nothing published it in the first
 * place (`/blog` renders source files).
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
      message_en: 'This build has no submission store — there is nothing to unpublish.',
      message_zh: '本站没有投稿数据表 —— 没有可以下架的内容。',
    },
  })
})
