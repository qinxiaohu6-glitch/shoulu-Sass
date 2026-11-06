/**
 * DELETE /api/admin/categories — delete a content category.
 *
 * Refuses: no `taxonomy` table, so there is no row to delete. The confirmation
 * dialog stays because the page is the source's.
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
      message_en: 'This build has no content taxonomy — the blog is not shipped, so there is no category to delete.',
      message_zh: '本站没有内容分类表 —— 博客尚未上线，没有可以删除的分类。',
    },
  })
})
