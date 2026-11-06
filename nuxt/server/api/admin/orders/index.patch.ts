/**
 * PATCH /api/admin/orders — edit one order from the console.
 *
 * The source's dialog sends `{ orderNo, status, productId, productName,
 * description }` and its handler writes all four. Here only `status` has a
 * column: `payment_order` records the attempt (provider, amount, session), and
 * the product copy lives on the listing, not on the payment. So the status is
 * applied and the three product fields are accepted for request compatibility
 * but not stored — the dialog prefills them from the row, which is why saving
 * without touching them is the normal path.
 *
 * Status is restricted the way the dialog restricts it: the current value, plus
 * `failed` while the order is still unpaid. Everything else (paid, refunded)
 * belongs to the provider's webhook, not to a form.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { setOrderStatus, type OrderStatus } from '../../../utils/payments/orders'

const EDITABLE_FROM_UNPAID = ['pending', 'created']
/** This table's own vocabulary — `payment_order.status`. */
const ALLOWED: OrderStatus[] = ['pending', 'paid', 'failed', 'cancelled', 'refunded']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event)) as { orderNo?: string; status?: string } | null
  const orderNo = String(body?.orderNo ?? '').trim()
  const status = String(body?.status ?? '').trim() as OrderStatus

  if (!orderNo || !status) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: 'orderNo and status are required', message_zh: '缺少 orderNo 或 status' },
    })
  }

  if (!ALLOWED.includes(status)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: `Unknown status: ${status}`, message_zh: `未知状态：${status}` },
    })
  }

  const db = await useDb(event)
  const current = await db
    .prepare('SELECT status FROM payment_order WHERE id = ?')
    .bind(orderNo)
    .first<{ status: string }>()

  if (!current) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      data: { message_en: 'Order not found', message_zh: '订单不存在' },
    })
  }

  if (status !== current.status && !(EDITABLE_FROM_UNPAID.includes(current.status) && status === 'failed')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        message_en: 'Only an unpaid order can be closed by hand; paid and refunded states come from the provider.',
        message_zh: '只有未支付的订单可以手动关闭；已支付/已退款状态由支付平台回调决定。',
      },
    })
  }

  await setOrderStatus(db, orderNo, status)

  return { ok: true }
})
