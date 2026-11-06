/**
 * POST /api/admin/invite-codes — generate one or more codes.
 *
 * There is no `invite_code` table in this build and nothing redeems a code
 * (see `server/api/admin/invite-codes/index.get.ts`), so storing one would
 * create a row that promises a gate the site does not have. The dialog stays
 * because the page is the source's; submitting says why nothing happened.
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
      message_en: 'Sign-up is not invite-gated in this build, so there is nowhere to store a code.',
      message_zh: '本站注册不需要邀请码，没有可以保存邀请码的地方。',
    },
  })
})
