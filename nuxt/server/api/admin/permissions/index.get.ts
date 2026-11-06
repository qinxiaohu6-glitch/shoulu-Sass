/**
 * GET /api/admin/permissions — the permission catalogue.
 *
 * The source seeds a permission per admin capability (`posts.create`, …) and
 * checks them per request. This build has one admin token and no capability
 * model at all (`server/utils/admin.ts`), so the catalogue is empty and both
 * consumers render their own empty state — the roles page's "no permissions"
 * checklist and `/admin/permissions`' own table.
 *
 * Two shapes read this: the roles dialog takes `.items`, the permissions page
 * takes `.items` + `.total`. Paging parameters are accepted and ignored.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return { ok: true, items: [], total: 0 }
})
