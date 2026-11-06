/**
 * GET /api/admin/overrides — the pin/hide table as the console needs it.
 *
 * `items` is the raw rows (with timestamps) so the table can show when a switch
 * was last touched; `state` is the same data in the shape the pages consume, so
 * the console and the site can never disagree about what "pinned" means.
 *
 * 404 without the cookie, like the rest of `/api/admin/*`.
 */

import { isAdmin } from '../../utils/admin'
import { useDb } from '../../utils/db'
import { listOverrides, toState } from '../../utils/overrides'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const db = await useDb(event)
  const items = await listOverrides(db)
  return { ok: true, items, state: toState(items) }
})
