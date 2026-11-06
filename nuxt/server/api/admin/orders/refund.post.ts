/**
 * POST /api/admin/orders/refund — refund a paid order.
 *
 * The source calls the provider's refund API, deducts the credits the order
 * granted, and optionally cancels the subscription. None of that exists here:
 * `server/utils/payments/stripe.ts` implements checkout only, and a refund
 * reaches this build as a `charge.refunded` webhook that the provider sends
 * after someone refunds in its own dashboard. There is also no credit ledger to
 * deduct from.
 *
 * So the dialog stays (it is the source's) and confirming reports where a
 * refund actually happens, instead of moving money it cannot move.
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
      message_en:
        'Refunds are issued in the payment provider dashboard; this build only records the refund when its webhook arrives.',
      message_zh: '退款需要在支付平台后台发起，本站只在收到退款回调时记录状态。',
    },
  })
})
