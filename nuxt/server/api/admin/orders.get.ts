/**
 * GET /api/admin/orders — every payment attempt, newest first.
 *
 * The console needs this the moment a provider is connected, and it needs it
 * even before that: a row with `status = 'failed'` and a provider message is
 * the only way to find out that a key is wrong without asking the buyer.
 *
 * It also reports the wiring state, because "no orders" and "no provider" look
 * identical in a table and mean completely different things.
 */

import { isAdmin } from '../../utils/admin'
import { useDb } from '../../utils/db'
import { paymentConfig } from '../../utils/payments'
import { listOrders, orderStats } from '../../utils/payments/orders'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const db = await useDb(event)
  const [orders, stats] = await Promise.all([listOrders(db, 200), orderStats(db)])
  const config = paymentConfig(event)

  // "Is the provider we asked for actually wired?" — per provider, because the
  // three of them need different things. Waffo verifies callbacks with Waffo's
  // own platform key, so there is no webhook secret to be missing.
  const keyPresent =
    config.provider === 'waffo'
      ? Boolean(config.waffoMerchantId && config.waffoPrivateKey)
      : config.provider === 'creem'
        ? Boolean(config.creemApiKey)
        : Boolean(config.stripeSecretKey)

  const webhookPresent =
    config.provider === 'waffo'
      ? true
      : config.provider === 'creem'
        ? Boolean(config.creemSigningSecret)
        : Boolean(config.stripeWebhookSecret)

  return {
    ok: true,
    items: orders,
    stats,
    provider: {
      requested: config.provider || null,
      // The secrets themselves are never echoed — only whether they are set.
      key_present: keyPresent,
      webhook_present: webhookPresent,
      currency: config.currency,
    },
  }
})
