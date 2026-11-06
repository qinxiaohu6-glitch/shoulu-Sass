/**
 * POST /api/admin/guest-posts/:id/reject — reject and refund.
 *
 * Refuses: rejecting refunds the author's order through the payment provider,
 * and this build has no such call (refunds arrive as the provider's
 * `charge.refunded` webhook) and no submission row to mark rejected.
 */

import { isAdmin } from '../../../../utils/admin'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Bad Request',
    data: {
      message_en: 'Rejecting refunds through the payment provider, which this build only observes via webhooks — nothing was refunded.',
      message_zh: '拒绝投稿需要在支付平台发起退款，本站只在回调时记录退款 —— 本次没有发生任何退款。',
    },
  })
})
