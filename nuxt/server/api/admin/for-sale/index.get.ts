/**
 * GET /api/admin/for-sale — review queue.
 *
 * Ownership and spam are computed here. Income is passed through as text and
 * is not checked against any ledger. The seller email is omitted.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { cycleOf, listForSaleAdmin, missingForSaleTable } from '../../../utils/for-sale'
import { listingSpamReasons } from '~~/shared/utils/for-sale-state'
import { getPublicBySlug } from '../../../utils/submissions'
import { ownsSubmission } from '~~/shared/utils/for-sale-state'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (!isAdmin(event)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  try {
    const db = await useDb(event)
    const rows = await listForSaleAdmin(db)
    const items = []
    for (const row of rows) {
      const product = await getPublicBySlug(db, row.product_slug)
      const owns = Boolean(
        product && ownsSubmission(product, { sub: row.owner_sub, email: row.owner_email }),
      )
      const spam = listingSpamReasons({
        askingCents: row.asking_cents,
        revenue: row.revenue,
        profit: row.profit,
        team: row.team,
        stack: row.stack,
      })
      const cycle = cycleOf(row)
      items.push({
        id: row.id,
        product_slug: row.product_slug,
        product_name: row.product_name,
        asking_cents: row.asking_cents,
        revenue: row.revenue,
        profit: row.profit,
        team: row.team,
        stack: row.stack,
        status: cycle.status,
        paid: row.paid_at != null,
        reviewed: row.reviewed_at != null,
        owns,
        spam,
        updated_at: row.updated_at,
      })
    }
    return { ok: true, items }
  } catch (err) {
    if (missingForSaleTable(err)) return { ok: true, items: [] }
    throw err
  }
})
