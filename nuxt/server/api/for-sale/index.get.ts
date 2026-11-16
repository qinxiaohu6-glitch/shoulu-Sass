/**
 * GET /api/for-sale — public listings only.
 *
 * A row is included only after payment and review. Seller email is not selected
 * into the response.
 */

import { forSaleSkuReady, listPublicForSale, missingForSaleTable } from '../../utils/for-sale'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const ready = forSaleSkuReady(event)
  try {
    const db = await useDb(event)
    const items = await listPublicForSale(db)
    return { ok: true, sku_ready: ready, items }
  } catch (err) {
    if (missingForSaleTable(err)) return { ok: true, sku_ready: ready, items: [] }
    throw err
  }
})
