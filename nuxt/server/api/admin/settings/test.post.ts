/**
 * POST /api/admin/settings/test — run one group's connection test.
 *
 * Source `modules/config/settings-test.ts` calls the provider with the values in
 * the dialog (Stripe: create a test checkout, OpenAI: one completion, Telegram:
 * a getMe, …) and reports what came back. This build has none of those keys —
 * the settings are environment variables and none is configured here — so the
 * honest answer is the source's own failure shape: `success: false` plus the
 * reason. The dialog renders it as the red result.
 */

import { isAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = await readBody<{ group?: string }>(event).catch(() => ({}) as { group?: string })

  return {
    success: false,
    message: `This build has no ${body?.group || 'provider'} credentials to test with — settings come from environment variables and none is set.`,
  }
})
