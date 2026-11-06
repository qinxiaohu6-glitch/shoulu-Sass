/**
 * GET /api/payments/config — is a checkout available right now?
 *
 * The submit page asks this before rendering a "Pay now" button, because a
 * button that exists and then explains it cannot work is worse than no button.
 * The answer is public and contains no secrets: a provider name and a boolean.
 *
 * `requested` is reported separately from `ready` so the console can say
 * "you asked for Stripe but the secret is missing" instead of silently
 * pretending the site never had a provider.
 */

import { getPaymentProvider, paymentConfig } from '../../utils/payments'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const config = paymentConfig(event)
  const provider = getPaymentProvider(event)

  return {
    ok: true,
    ready: Boolean(provider),
    provider: provider?.id ?? null,
    requested: config.provider || null,
    currency: config.currency,
  }
})
