/**
 * POST /api/admin/users/credits — grant or deduct credits.
 *
 * There is no credits ledger in this build: nothing is metered, nothing is
 * spent, and the list's credits column is a constant 0. Writing a balance
 * without a ledger would produce a number nobody can audit, so the endpoint
 * reports the gap instead.
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
      message_en: 'This build has no credits ledger — nothing is metered, so there is no balance to change.',
      message_zh: '本站没有积分账本，没有可变更的余额。',
    },
  })
})
