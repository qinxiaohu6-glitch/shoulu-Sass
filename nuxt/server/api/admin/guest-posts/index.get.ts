/**
 * GET /api/admin/guest-posts — the review queue.
 *
 * Source `server/admin/handlers/guest-posts.ts` reads a `guest_post` table plus
 * the `post` it belongs to. This build sells no guest-post packages and stores
 * no submissions (`/api/guest-posts/info` reports `enabled: false`), so the
 * queue is empty and the page renders the source's own empty table.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return { ok: true, items: [], total: 0 }
})
