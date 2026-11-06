/**
 * POST /api/admin/users/password — set a user's password.
 *
 * The source has a password column and an email+password sign-in. This build
 * signs in with Google only (`server/api/auth/google*`), and the session is a
 * signed cookie carrying the Google `sub` — there is no password to set, and
 * inventing a column for one would create a second, weaker way in.
 *
 * The dialog stays because the page is the source's; pressing Save reports why
 * nothing happened instead of pretending it worked.
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
      message_en: 'This site signs in with Google only — there is no password to set.',
      message_zh: '本站只用 Google 登录，没有密码可设置。',
    },
  })
})
