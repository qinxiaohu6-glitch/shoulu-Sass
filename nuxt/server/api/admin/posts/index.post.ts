/**
 * POST /api/admin/posts — create a post.
 *
 * Refuses: `/blog` renders `shared/content/blog.ts`, and nothing reads a `post`
 * table, so a created row would never appear on the site. The dialog stays
 * because the page is the source's; submitting says why nothing happened.
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
      message_en: 'This build has no post store — /blog renders source files, so a new post would never appear.',
      message_zh: '本站没有文章表 —— /blog 渲染的是源码里的文件，新建的文章不会出现在站点上。',
    },
  })
})
