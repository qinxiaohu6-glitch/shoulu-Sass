/**
 * GET /api/for-sale/config — is the dedicated $9.90 product id present?
 *
 * Directory checkout can be ready while this stays false. A wildcard Waffo
 * product does not make the for-sale SKU buyable.
 */

import { forSaleSkuReady } from '../../utils/for-sale'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  return { ok: true, ready: forSaleSkuReady(event) }
})
