/**
 * Waffo Pancake — one-off checkout, delegated to the official SDK.
 *
 * The first version of this file hand-rolled RSA-SHA256 with Web Crypto,
 * because the SDK was believed to need `node:crypto`'s `createSign`, which a
 * Worker was said to only partially provide. That is no longer true: Cloudflare
 * documents `node:crypto` as *fully supported* in Workers, with exceptions that
 * do not include `createSign`, `createPrivateKey` or `createPublicKey`. Waffo's
 * own integration guide is also explicit — "Never implement RSA-SHA256 signing
 * manually — the SDK handles it." So signing, PEM parsing (PKCS#1 and PKCS#8)
 * and webhook verification are the SDK's job now; this file is only the
 * translation layer between its vocabulary and ours.
 *
 * Three decisions that are still ours:
 *
 * · **Anonymous checkout, not authenticated.** The SDK's `checkout.authenticated`
 *   path issues a customer session token first, because it has a `customer.id`.
 *   A directory submission has an email and nothing else, so the single
 *   `create-session` call is the same purchase without inventing an identity.
 *
 * · **The amount is sent, never read.** `priceSnapshot` carries the price the
 *   pricing table produced, so the dashboard product's own price is overridden
 *   and `order.amount_cents` always equals what the buyer was charged.
 *
 * · **The webhook window is the SDK's default 45 minutes.** It is not a magic
 *   number to tune: the timestamp is stamped before the first delivery attempt
 *   and every retry reuses it, so the last retry (about 31 minutes later)
 *   arrives with an old timestamp. A shorter window rejects deliveries Waffo
 *   considers valid. Replay is handled where it belongs — `settleOrder` only
 *   moves a row out of `pending`.
 */

import { WaffoPancake, WaffoPancakeError, verifyWebhook } from '@waffo/pancake-ts'
import type { TaxCategory, WebhookEvent, WebhookEventData } from '@waffo/pancake-ts'
import { PaymentError, headerOf } from './types'
import type { CheckoutRequest, CheckoutSession, PaymentEvent, PaymentProvider } from './types'

const SIGNATURE_HEADER = 'x-waffo-signature'

/**
 * Currencies whose smallest unit *is* the unit. Waffo takes amounts as display
 * strings ("39.00" or "4500"), so the conversion has to know which ones have no
 * minor unit — dividing JPY by 100 would ask for a ¥0.39 charge.
 */
const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW',
  'PYG', 'RWF', 'UGX', 'UYU', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

/** The SDK types `taxCategory` as an enum; an unknown string is a 400 at Waffo. */
const TAX_CATEGORIES = [
  'digital_goods',
  'saas',
  'software',
  'ebook',
  'online_course',
  'consulting',
  'professional_service',
] as const

export interface WaffoConfig {
  merchantId: string
  /** PEM. PKCS#8 (`BEGIN PRIVATE KEY`) or PKCS#1 (`BEGIN RSA PRIVATE KEY`). */
  privateKey: string
  /** Empty means "do not pin": a webhook is then accepted from either key. */
  environment: 'test' | 'prod' | ''
  /** Used when the plan has no entry in `productIds`. */
  productId: string
  /** plan slug → Waffo product id, for deployments with one product per tier. */
  productIds: Record<string, string>
  /** Waffo's tax bucket for the product, e.g. `digital_goods`. */
  taxCategory: string
  /** Overrides the bundled platform key. Rarely needed. */
  webhookPublicKey: string
}

export function waffoProvider(config: WaffoConfig): PaymentProvider {
  const configured = () => Boolean(config.merchantId && config.privateKey)

  /**
   * One client per isolate, built lazily. Constructing it parses the PEM, which
   * is not free, and a webhook-only cold start should not pay for it.
   */
  let cached: WaffoPancake | null = null
  const client = (): WaffoPancake => {
    if (!cached) {
      cached = new WaffoPancake({
        merchantId: config.merchantId,
        privateKey: config.privateKey,
        ...(config.webhookPublicKey ? { webhookPublicKey: config.webhookPublicKey } : {}),
      })
    }
    return cached
  }

  return {
    id: 'waffo',
    configured,

    async createCheckout(input: CheckoutRequest): Promise<CheckoutSession> {
      if (!configured()) throw new PaymentError('not_configured')

      const productId = config.productIds[input.plan] || config.productIds['*'] || config.productId
      if (!productId) {
        // A missing product id is a configuration gap, not a provider outage.
        // Saying so here puts the reason in the order's `note` column, which is
        // the difference between "fix the map" and "ask Waffo support".
        throw new PaymentError(
          'not_configured',
          `No Waffo product id for plan "${input.plan}"`,
        )
      }

      try {
        const session = await client().checkout.createSession({
          productId,
          currency: input.currency.toUpperCase(),
          // Overrides the dashboard price, so the charge equals the order row.
          priceSnapshot: {
            amount: toAmountString(input.amountCents, input.currency),
            taxCategory: taxCategoryOf(config.taxCategory),
          },
          // Optional at Waffo: an anonymous buyer is asked for it on the hosted
          // page. Sending it pre-fills the field and is what puts the address on
          // the order and the receipt.
          ...(input.email ? { buyerEmail: input.email } : {}),
          successUrl: input.successUrl,
          // Echoed back on every event for this order, refunds included.
          orderMerchantExternalId: input.orderId,
          metadata: {
            order_id: input.orderId,
            submission_id: input.submissionId,
            plan: input.plan,
          },
        })

        return { ref: session.sessionId, url: session.checkoutUrl }
      } catch (err) {
        // Everything the SDK can fail on — bad signature, rejected product,
        // network — is the same thing to the caller: the provider did not
        // produce a checkout. The detail is kept for the order's note.
        throw new PaymentError('provider_error', describe(err))
      }
    },

    async parseWebhook(
      rawBody: string,
      headers: Record<string, string>,
    ): Promise<PaymentEvent | 'ignored' | null> {
      const signature = headerOf(headers, SIGNATURE_HEADER)
      if (!signature) return null

      let event: WebhookEvent<WebhookEventData>
      try {
        // Verifies the RSA-SHA256 signature against Waffo's platform key and
        // enforces the 45-minute replay window. A throw is "not from Waffo".
        event = verifyWebhook<WebhookEventData>(rawBody, signature, {
          ...(config.environment ? { environment: config.environment } : {}),
          ...(config.webhookPublicKey ? { publicKey: config.webhookPublicKey } : {}),
        })
      } catch {
        return null
      }

      // The same RSA key pair exists in both environments, so a test-mode event
      // would verify against a production key. The `mode` field is what
      // separates them; a pinned environment rejects the other one outright —
      // authentic, but not ours to act on.
      if (config.environment && event.mode && event.mode !== config.environment) return 'ignored'

      return translate(event) ?? 'ignored'
    },
  }
}

/**
 * Waffo's event vocabulary → ours.
 *
 * Only a one-off listing is being sold, so two events matter: the money
 * arrived, and the money went back. `subscription.*` and `store.*` return
 * null; subscribing the webhook to them would only produce noise.
 */
function translate(event: WebhookEvent<WebhookEventData>): PaymentEvent | null {
  const data = event.data
  if (!data) return null

  const orderId = data.orderMerchantExternalId || data.orderMetadata?.order_id || ''
  if (!orderId) return null

  // `paymentId` is the payment this event is about; `eventId` is the business
  // object behind it and `id` is only the delivery. Any of them identifies the
  // charge for reconciliation, so fall back rather than drop the event.
  const providerRef = data.paymentId || event.eventId || event.id || ''
  const currency = String(data.currency || 'usd')
  const email = data.buyerEmail || ''

  if (event.eventType === 'order.completed') {
    return {
      orderId,
      providerRef,
      status: 'paid',
      // `chargedAmount` is what the buyer's card was actually charged (tax
      // included); `amount` is the same field under its deprecated name. If a
      // tax setting in the Waffo store makes these exceed the listing price,
      // the caller accepts the excess and records it on the order.
      amountCents: fromAmountString(data.chargedAmount ?? data.amount, currency),
      currency: currency.toLowerCase(),
      email,
      raw: event,
    }
  }

  if (event.eventType === 'refund.succeeded') {
    return {
      orderId,
      providerRef,
      status: 'refunded',
      amountCents: fromAmountString(data.refundedAmount ?? data.amount, currency),
      currency: currency.toLowerCase(),
      email,
      raw: event,
    }
  }

  return null
}

/** `WaffoPancakeError` carries the root cause in `errors[0]`, per Waffo's docs. */
function describe(err: unknown): string {
  if (err instanceof WaffoPancakeError) {
    const detail = err.errors
      ?.map((entry) => entry?.message)
      .filter(Boolean)
      .join('; ')
    return detail || `HTTP ${err.status}`
  }
  return err instanceof Error ? err.message : 'provider_error'
}

function taxCategoryOf(raw: string): TaxCategory {
  const value = raw.trim().toLowerCase()
  return ((TAX_CATEGORIES as readonly string[]).includes(value)
    ? value
    : 'digital_goods') as TaxCategory
}

/* -------------------------------------------------------------------------
   amounts — minor units in, Waffo's display strings out
------------------------------------------------------------------------- */

function toAmountString(cents: number, currency: string): string {
  if (ZERO_DECIMAL.has(currency.toUpperCase())) return String(Math.round(cents))
  return (cents / 100).toFixed(2)
}

function fromAmountString(value: string | undefined, currency: string): number {
  if (!value) return 0
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(parsed)) return 0
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(parsed) : Math.round(parsed * 100)
}
