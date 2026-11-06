/**
 * GET /api/admin/agent/audit — the agent call log.
 *
 * Source `server/admin/handlers/agent.ts` reads the execution table: one row
 * per call an agent made with its key, `page` / `pageSize` / `userId` filters,
 * newest first. Nothing here ever ran an agent, and there is no execution table
 * to read, so the answer is the paged envelope with no rows — the page's own
 * "No agent activity yet" state.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return { ok: true, items: [], total: 0 }
})
