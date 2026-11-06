/**
 * GET /api/admin/credits — the credit ledger (`?userId=` narrows it to one user).
 *
 * Source `server/admin/handlers/credits.ts` reads a `credit` table. Nothing in
 * this build is metered — there is no AI task, no paid action and no grant path
 * — so the ledger is empty and the page renders the source's own empty table.
 * `POST /api/admin/users/credits` refuses for the same reason.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return { ok: true, items: [], total: 0 }
})
