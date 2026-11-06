/**
 * GET /api/admin/guest-posts/:id — one submission, for the review panel.
 *
 * Refuses with 404: nothing is stored, so every id misses. The panel prints the
 * message where the article would be — the same place the source prints a
 * missing submission.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  throw createError({
    statusCode: 404,
    statusMessage: 'Not Found',
    data: {
      message_en: 'Submission not found — guest posts are not sold in this build, so nothing was ever submitted.',
      message_zh: '找不到该投稿 —— 本站不售卖投稿套餐，也没有任何投稿记录。',
    },
  })
})
