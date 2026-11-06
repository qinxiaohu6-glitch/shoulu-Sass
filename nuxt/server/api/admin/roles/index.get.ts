/**
 * GET /api/admin/roles — the role list.
 *
 * Two shapes, both from the source page:
 *   `?userId=<id>`  the roles that user holds (the Manage Roles dialog)
 *   otherwise       every role (the same dialog's checklist, and `/admin/roles`)
 *
 * There is no roles table in this build: exactly one person runs the site and
 * `/admin` is gated by a single token (see `server/utils/admin.ts`), so a role
 * has nothing to grant. Both shapes answer empty, which is the source's own
 * `admin.roles.no_roles` state.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return { ok: true, items: [], total: 0 }
})
