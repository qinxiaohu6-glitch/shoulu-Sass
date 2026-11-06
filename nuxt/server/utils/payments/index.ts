/**
 * Which provider, if any, is switched on.
 *
 * `null` is a first-class answer, not a failure. The site has taken money
 * without a provider since it launched: the submitter is told to pay, the
 * operator confirms by hand, `confirmPayment()` publishes. That path must keep
 * working while a merchant account is being approved, and it must keep working
 * if the account is ever frozen — so "no provider" degrades to the manual flow
 * rather than to a broken checkout button.
 *
 * Selection is by name in `NUXT_PAYMENT_PROVIDER`, not by "whichever secrets
 * happen to be present". A half-configured provider that silently activates is
 * how a site ends up charging through a test key.
 */

import type { H3Event } from 'h3'
import { creemProvider } from './creem'
import { stripeProvider } from './stripe'
import { waffoProvider } from './waffo'
import type { PaymentProvider } from './types'

export type { PaymentEvent, PaymentProvider, PaymentProviderId } from './types'
export { PaymentError } from './types'

export function paymentConfig(event: H3Event) {
  const cfg = useRuntimeConfig(event)
  return {
    provider: String(cfg.paymentProvider || '').trim().toLowerCase(),
    currency: String(cfg.paymentCurrency || 'usd').trim().toLowerCase(),

    stripeSecretKey: String(cfg.stripeSecretKey || '').trim(),
    stripeWebhookSecret: String(cfg.stripeWebhookSecret || '').trim(),

    waffoMerchantId: String(cfg.waffoMerchantId || '').trim(),
    // The PEM is multi-line; trimming is safe, normalising whitespace is not.
    waffoPrivateKey: String(cfg.waffoPrivateKey || '').trim(),
    waffoEnvironment: String(cfg.waffoEnvironment || '').trim().toLowerCase(),
    waffoProductId: String(cfg.waffoProductId || '').trim(),
    // Nuxt runs `destr()` over every NUXT_* env var in `applyEnv`, so a JSON
    // product map arrives here already parsed as an object. Do not `String()`
    // it — that produces `[object Object]` and every tier then looks unmapped.
    // `parseProductIds` accepts both shapes.
    waffoProductIds: cfg.waffoProductIds as unknown,
    waffoTaxCategory: String(cfg.waffoTaxCategory || 'digital_goods').trim(),
    waffoWebhookPublicKey: String(cfg.waffoWebhookPublicKey || '').trim(),

    creemApiKey: String(cfg.creemApiKey || '').trim(),
    creemSigningSecret: String(cfg.creemSigningSecret || '').trim(),
    creemEnvironment: String(cfg.creemEnvironment || '').trim().toLowerCase(),
    creemProductIds: cfg.creemProductIds as unknown,
  }
}

/**
 * The live provider, or null for the manual flow.
 *
 * `NUXT_PAYMENT_PROVIDER=stripe` with a missing secret returns null *and*
 * `paymentConfig().provider` still says "stripe" — the admin console uses that
 * difference to say "you asked for Stripe but the key is missing" instead of
 * quietly showing the manual instructions.
 */
export function getPaymentProvider(event: H3Event): PaymentProvider | null {
  const config = paymentConfig(event)

  if (config.provider === 'stripe') {
    const provider = stripeProvider({
      secretKey: config.stripeSecretKey,
      webhookSecret: config.stripeWebhookSecret,
    })
    return provider.configured() ? provider : null
  }

  if (config.provider === 'waffo') {
    const provider = waffoProvider({
      merchantId: config.waffoMerchantId,
      privateKey: config.waffoPrivateKey,
      environment:
        config.waffoEnvironment === 'test' || config.waffoEnvironment === 'prod'
          ? config.waffoEnvironment
          : '',
      productId: config.waffoProductId,
      productIds: parseProductIds(config.waffoProductIds),
      taxCategory: config.waffoTaxCategory,
      webhookPublicKey: config.waffoWebhookPublicKey,
    })
    return provider.configured() ? provider : null
  }

  if (config.provider === 'creem') {
    const provider = creemProvider({
      apiKey: config.creemApiKey,
      signingSecret: config.creemSigningSecret,
      environment: config.creemEnvironment,
      productIds: parseProductIds(config.creemProductIds),
    })
    return provider.configured() ? provider : null
  }

  return null
}

/**
 * `{"standard":"PROD_x","featured":"PROD_y"}` → a map.
 *
 * A bare `PROD_x` is accepted too and means "every plan uses this product".
 * That is the fast path for Waffo, where the amount travels with the checkout
 * (`priceSnapshot`), so one product can serve all four tiers. Creem has no
 * such override, which is why its map has to name every plan that can be
 * bought. Unparseable JSON yields an empty map: the checkout then fails with
 * "no product id for plan X" rather than silently charging the wrong price.
 *
 * The input is `unknown` on purpose. Nuxt's `applyEnv` runs `destr()` over
 * every `NUXT_*` variable, so the JSON form is already an object by the time
 * it reaches here; only the bare-id form is still a string. Forcing both
 * through `String()` is what made a correctly configured deployment report
 * "No Creem product id for plan featured".
 */
function parseProductIds(raw: unknown): Record<string, string> {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return collectProductIds(raw as Record<string, unknown>)
  }

  const text = String(raw).trim()
  if (!text) return {}
  if (!text.startsWith('{')) return { '*': text }
  try {
    return collectProductIds(JSON.parse(text) as Record<string, unknown>)
  } catch {
    return {}
  }
}

function collectProductIds(parsed: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim()
  }
  return out
}

/** Where a provider should send the browser back to. */
export function returnUrls(event: H3Event, orderId: string) {
  const base = String(useRuntimeConfig(event).siteUrl || 'https://dirtool.com').replace(/\/+$/, '')
  return {
    successUrl: `${base}/payment/return?order=${encodeURIComponent(orderId)}`,
    cancelUrl: `${base}/payment/return?order=${encodeURIComponent(orderId)}&state=cancelled`,
  }
}
