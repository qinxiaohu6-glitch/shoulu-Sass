/**
 * GET /api/admin/users/sources — the source filter's options.
 *
 * The source groups `users.utm_source`. Nothing in this build records a campaign
 * source, so the list is empty and the filter renders with only its "Any" entry —
 * the source's own behaviour for a site with no attributed sign-ups.
 */

import { isAdmin } from '../../../utils/admin'
import { listAdminUserSources } from '../../../utils/admin-users'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return { ok: true, items: await listAdminUserSources() }
})
