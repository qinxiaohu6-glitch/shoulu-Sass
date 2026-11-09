/**
 * GET /api/admin/billboard — every placement, including unpaid ones.
 * 404 without the owner cookie, same as the rest of /api/admin.
 */

import { isAdmin } from '../../utils/admin'
import { listAllBillboard } from '../../utils/billboard'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  const db = await useDb(event)
  const items = await listAllBillboard(db)
  return {
    ok: true as const,
    items,
    stats: {
      total: items.length,
      live: items.filter((item) => item.status === 'live' && item.paidAt).length,
      pending: items.filter((item) => item.status === 'pending' || item.status === 'requested').length,
    },
  }
})
