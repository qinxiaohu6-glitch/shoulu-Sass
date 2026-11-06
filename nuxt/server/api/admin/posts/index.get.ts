/**
 * GET /api/admin/posts — the post list, or one post (`?id=`) for the editor.
 *
 * Source `server/admin/handlers/posts.ts` reads a `post` table. This build has
 * no CMS: `/blog` renders two hand-written posts from `shared/content/blog.ts`,
 * so there is nothing for an editor to list and nothing for it to load by id.
 * The page therefore renders the source's own empty table.
 *
 * `/admin/guest-posts` is the other half of the source's `post` table (`type =
 * 'guest'`) and is empty for the same reason.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)

  // Single post, with content — the editor's second fetch. Nothing is stored,
  // so every id misses; the page swallows this and keeps an empty body.
  if (typeof query.id === 'string' && query.id) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      data: {
        message_en: 'Post not found — this build stores posts in source files, not in the database.',
        message_zh: '找不到该文章 —— 本站的文章写在源码文件里，不在数据库中。',
      },
    })
  }

  return { ok: true, items: [], total: 0 }
})
