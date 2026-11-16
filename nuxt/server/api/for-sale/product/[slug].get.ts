/**
 * GET /api/for-sale/product/:slug — the product-page module.
 *
 * Public card only when paid and reviewed. `can_list` is true for the signed-in
 * owner of the live directory page. Seller email is not included.
 */

import { isPublicForSale } from '~~/shared/utils/for-sale-state'
import {
  cycleOf,
  forSaleSkuReady,
  getForSaleBySlug,
  missingForSaleTable,
  ownerView,
} from '../../../utils/for-sale'
import { useDb } from '../../../utils/db'
import { getPublicBySlug } from '../../../utils/submissions'
import { readSession } from '../../../utils/session'
import { ownsSubmission, toPublicForSaleCard } from '~~/shared/utils/for-sale-state'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const slug = String(getRouterParam(event, 'slug') || '').trim()
  const ready = forSaleSkuReady(event)
  const empty = { ok: true, sku_ready: ready, card: null, can_list: false, mine: null }
  if (!slug) return empty

  try {
    const db = await useDb(event)
    const session = await readSession(event)
    const product = await getPublicBySlug(db, slug)
    const canList = Boolean(session && product && ownsSubmission(product, session))
    const row = await getForSaleBySlug(db, slug)
    if (!row) return { ...empty, can_list: canList }

    let interested = 0
    if (isPublicForSale(cycleOf(row))) {
      const count = await db
        .prepare('SELECT COUNT(*) AS n FROM for_sale_interest WHERE listing_id = ?')
        .bind(row.id)
        .first<{ n: number }>()
      interested = Number(count?.n ?? 0)
    }
    const card = toPublicForSaleCard({
      id: row.id,
      product_slug: row.product_slug,
      product_name: row.product_name,
      asking_cents: row.asking_cents,
      revenue: row.revenue,
      profit: row.profit,
      team: row.team,
      stack: row.stack,
      status: cycleOf(row).status,
      paidAt: row.paid_at,
      reviewedAt: row.reviewed_at,
      interested,
      owner_email: row.owner_email,
    })
    const mine = session && ownsSubmission(row, session) ? ownerView(row, interested) : null
    return { ok: true, sku_ready: ready, card, can_list: canList, mine }
  } catch (err) {
    if (missingForSaleTable(err)) return empty
    throw err
  }
})
