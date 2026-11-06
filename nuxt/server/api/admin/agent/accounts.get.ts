/**
 * GET /api/admin/agent/accounts — the agent service accounts.
 *
 * Source `server/admin/handlers/agent.ts` lists `api`-type users with their
 * roles and their keys. This build has one owner and one token
 * (see `server/utils/admin.ts`): there is no users table to hold an `api`-type
 * row and no key table to hang off it, so the list is empty — the page's own
 * "No agents yet" state, which is also what a fresh source install shows.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return []
})
