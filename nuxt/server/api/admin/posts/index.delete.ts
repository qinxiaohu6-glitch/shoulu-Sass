/**
 * DELETE /api/admin/posts — delete a post.
 *
 * Refuses: `/blog` renders source files, so there is no row to delete. The
 * confirmation dialog stays because the page is the source's.
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
      message_en: 'This build has no post store — /blog renders source files, so there is no post to delete.',
      message_zh: '本站没有文章表 —— /blog 渲染的是源码里的文件，没有可以删除的文章。',
    },
  })
})
