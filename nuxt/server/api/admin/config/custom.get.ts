/**
 * GET /api/admin/config/custom — the "Custom" tab's key/value rows.
 *
 * Source `server/admin/handlers/config.ts` lists every saved key the registry
 * does not define. Nothing is stored here (see `config.get.ts`), so the list is
 * empty and the tab shows its own "nothing yet" line.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return []
})
