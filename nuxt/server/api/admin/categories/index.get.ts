/**
 * GET /api/admin/categories — the *content* taxonomy (blog categories).
 *
 * Source `server/admin/handlers/categories.ts` reads `taxonomy` rows with
 * `type = 'category'`. This build has no content taxonomy: the blog is not
 * shipped (see `/blog`), so there is nothing to categorise and the page renders
 * the source's own empty table.
 *
 * Not to be confused with `/api/admin/directory/categories`, which lists
 * `dir_category` and backs `/admin/directory/categories` — the source keeps
 * those two pages on two different stores, and so does this build.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  // `?all=true` answers a bare array for dropdowns (the post editor's category
  // picker), exactly as the source's handler does — not the paged envelope.
  if (getQuery(event).all === 'true') {
    return []
  }

  return { ok: true, items: [], total: 0 }
})
