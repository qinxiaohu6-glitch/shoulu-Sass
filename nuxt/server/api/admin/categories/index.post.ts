/**
 * POST /api/admin/categories — create a content category.
 *
 * Refuses: there is no `taxonomy` table in this build, so a created category
 * would be a row nothing reads. The dialog stays because the page is the
 * source's; submitting says why nothing happened.
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
      message_en: 'This build has no content taxonomy — the blog is not shipped, so a category would have nothing to hold.',
      message_zh: '本站没有内容分类表 —— 博客尚未上线，新建的分类没有可以归类的内容。',
    },
  })
})
