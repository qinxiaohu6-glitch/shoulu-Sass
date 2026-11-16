/**
 * GET /api/for-sale/mine — the signed-in seller's products and listings.
 * No email address in the payload.
 */

import {
  forSaleSkuReady,
  getForSaleBySlug,
  missingForSaleTable,
  ownedLiveProducts,
  ownerView,
  requireSeller,
} from '../../utils/for-sale'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const session = await requireSeller(event)
  const ready = forSaleSkuReady(event)
  try {
    const db = await useDb(event)
    const products = await ownedLiveProducts(db, session)
    const listings = []
    for (const product of products) {
      const row = await getForSaleBySlug(db, product.slug)
      if (row && row.owner_sub === session.sub) listings.push(ownerView(row, 0))
    }
    return {
      ok: true,
      sku_ready: ready,
      products: products.map((product) => ({ slug: product.slug, name: product.name })),
      listings,
    }
  } catch (err) {
    if (missingForSaleTable(err)) {
      return { ok: true, sku_ready: ready, products: [], listings: [] }
    }
    throw err
  }
})
