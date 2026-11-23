/**
 * POST /api/billboard/checkout — new bids are closed.
 *
 * A placement that was already paid still renders. The webhook can still
 * settle an order created before this close. This route no longer opens one.
 * The weekly launch-board ad is the product sold in its place.
 */

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  throw createError({
    statusCode: 409,
    statusMessage: 'Conflict',
    data: {
      reason: 'billboard_closed',
      message_en:
        'New Billboard bids are closed. Book the weekly launch-board ad instead. A bid already paid stays on the board.',
      message_zh: 'Billboard 已停止新出价。请改订每周的发布榜广告。已经付款的出价仍留在榜上。',
    },
  })
})
