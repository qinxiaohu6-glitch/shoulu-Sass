/**
 * GET /api/admin/roles/permissions?roleId= — the permissions a role holds.
 *
 * There are no roles and no permission assignments (see `index.get.ts` in this
 * folder), so the answer is an empty list — the same shape the Manage Role
 * Permissions dialog expects, which then renders its own "no permissions"
 * state.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return { ok: true, items: [] }
})
