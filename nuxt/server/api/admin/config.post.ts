/**
 * POST /api/admin/config — save one or more settings.
 *
 * Refuses: this build has no config table, and its settings are environment
 * variables (`NUXT_PAYMENT_PROVIDER`, `NUXT_SITE_URL`, …) read at boot — a row
 * written here would be read by nothing. The form stays because the page is the
 * source's; Save says why nothing was stored.
 */

import { isAdmin } from '../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Bad Request',
    data: {
      message_en: 'This build reads its settings from environment variables at boot, not from a config table, so nothing was saved. Change the matching NUXT_* variable and restart.',
      message_zh: '本站的设置来自启动时读取的环境变量，而不是配置表，因此没有保存。请修改对应的 NUXT_* 变量并重启。',
    },
  })
})
