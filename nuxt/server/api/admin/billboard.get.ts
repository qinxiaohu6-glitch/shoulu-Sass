/**
 * GET /api/admin/billboard — every placement, including unpaid ones.
 * 404 without the owner cookie, same as the rest of /api/admin.
 */

import { isAdmin } from '../../utils/admin'
import { listAllBillboard } from '../../utils/billboard'
import { useDb } from '../../utils/db'
import { backingCents, publicBillboardRows, rankBillboard, type BillboardRow } from '~~/shared/utils/billboard'
import { screenshotSrc } from '~~/shared/utils/screenshot'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  const db = await useDb(event)
  const items = await listAllBillboard(db)
  const liveRows: BillboardRow[] = items
    .filter((item) => item.status === 'live' && typeof item.paidAt === 'number')
    .map((item) => ({
      id: item.id,
      tier: item.tier as BillboardRow['tier'],
      name: item.name,
      tagline: item.tagline,
      url: item.url,
      logo: item.logo,
      screenshot: item.screenshot,
      paidAt: item.paidAt as number,
      status: 'live',
      amountCents: item.amountCents,
    }))
  const stacked = rankBillboard(publicBillboardRows(liveRows)).map((row, index) => ({
    id: row.id,
    rank: index + 1,
    name: row.name,
    url: row.url,
    amountCents: backingCents(row),
    screenshot: screenshotSrc(row.screenshot),
    logo: row.logo,
  }))
  return {
    ok: true as const,
    items,
    stacked,
    stats: {
      total: items.length,
      live: items.filter((item) => item.status === 'live' && item.paidAt).length,
      pending: items.filter((item) => item.status === 'pending' || item.status === 'requested').length,
    },
  }
})
