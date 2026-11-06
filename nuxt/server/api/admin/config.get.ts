/**
 * GET /api/admin/config — the saved settings.
 *
 * Source `server/admin/handlers/config.ts` reads the `config` table and masks
 * every secret before answering. This build has no config table: settings come
 * from the environment (`runtimeConfig` in `nuxt.config.ts`), so the page gets
 * an empty map and shows each field's default — which is also what the source
 * shows on a fresh install.
 */

import { isAdmin } from '../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return {}
})
