/**
 * GET /api/admin/invite-codes — the invite-code list.
 *
 * Source `server/admin/handlers/invite-codes.ts` reads an `invite_code` table
 * and answers three tabs (`all` / `available` / `used`) plus a search. This
 * build has no such table: sign-up is Google-only and not gated, which is why
 * `/redeem-invite` reports every code as invalid (`invite_code_required` is
 * false). The list is therefore the source's own "No invite codes yet" state,
 * and `POST` / `DELETE` refuse rather than pretend to write a row.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return { ok: true, items: [], total: 0 }
})
