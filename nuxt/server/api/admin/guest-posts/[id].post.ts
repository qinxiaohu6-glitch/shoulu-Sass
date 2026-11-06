/**
 * POST /api/admin/guest-posts/:id — approve or request changes.
 *
 * Refuses: approving would publish a post into a CMS this build does not have,
 * and there is no submission row to move between states.
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
      message_en: 'This build has no submission store — there is no review state to change.',
      message_zh: '本站没有投稿数据表 —— 没有可以变更的审核状态。',
    },
  })
})
