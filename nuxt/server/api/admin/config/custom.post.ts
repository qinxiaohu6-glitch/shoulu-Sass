/**
 * POST /api/admin/config/custom — save the "Custom" tab's key/value rows.
 *
 * Refuses: there is no config table to write them to (see `config.get.ts`). The
 * tab stays because the page is the source's; Save says why nothing was stored.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Bad Request',
    data: {
      message_en: 'This build has no config table, so custom keys would be stored nowhere.',
      message_zh: '本站没有配置表，自定义键没有可以保存的位置。',
    },
  })
})
