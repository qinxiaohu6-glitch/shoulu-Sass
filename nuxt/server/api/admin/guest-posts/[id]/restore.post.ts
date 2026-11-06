/**
 * POST /api/admin/guest-posts/:id/restore — republish, or request changes on a
 * taken-down article.
 *
 * Refuses: there is no submission store, so nothing can move back into the
 * review queue.
 */

import { isAdmin } from '../../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Bad Request',
    data: {
      message_en: 'This build has no submission store — there is no review state to restore.',
      message_zh: '本站没有投稿数据表 —— 没有可以恢复的审核状态。',
    },
  })
})
