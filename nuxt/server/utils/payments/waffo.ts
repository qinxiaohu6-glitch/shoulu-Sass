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
 * · **The amount is sent and checked.** `priceSnapshot` carries the price the
 *   pricing table produced. Waffo drops that field on any call that is not
 *   signed as the merchant, and then charges the product's stored price
 *   without saying so. Before a session is opened, the stored USD price is
 *   read back. A product that exists only for this charge is repriced through
 *   the API when it has drifted. A shared product is never repriced, and a
 *   session is not opened when the stored price still differs.
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
import {
  amountsEqual,
  catalogueAmount,
  fromAmountString,
  productLockedToAmount,
  selectProductId,
  sessionQuote,
  toAmountString,
} from '~~/shared/payments/waffo-amount'
import { PaymentError, headerOf } from './types'
import type { CheckoutRequest, CheckoutSession, PaymentEvent, PaymentProvider } from './types'

const SIGNATURE_HEADER = 'x-waffo-signature'

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
      if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
        throw new PaymentError('bad_amount', 'Amount must be a positive number of cents')
      }

      const expected = toAmountString(input.amountCents, input.currency)
      const productId = selectProductId(
        config.productIds,
        input.plan,
        input.amountCents,
        config.productId,
      )
      if (!productId) {
        // A missing product id is a configuration gap, not a provider outage.
        // Saying so here puts the reason in the order's `note` column, which is
        // the difference between "fix the map" and "ask Waffo support".
        throw new PaymentError(
          'not_configured',
          `No Waffo product id for plan "${input.plan}" at ${expected}`,
        )
      }

      try {
        const pancake = client()
        const locked = productLockedToAmount(config.productIds, productId, input.amountCents)
        let stored = await readCatalogueAmount(pancake, productId, input.currency)
        if (!amountsEqual(stored, input.amountCents, input.currency)) {
          // Repricing a product that other charges share would make the next
          // buyer pay this buyer's amount. Refuse instead.
          if (!locked) {
            throw new PaymentError(
              'bad_amount',
              `Waffo product ${productId} is priced ${stored ?? 'unknown'} ${input.currency.toUpperCase()}, the page charges ${expected}. Checkout was not opened.`,
            )
          }
          const updated = await pancake.onetimeProducts.update({
            id: productId,
            prices: {
              [input.currency.toUpperCase()]: {
                amount: expected,
                taxCategory: taxCategoryOf(config.taxCategory),
              },
            },
          })
          stored = catalogueAmount(updated.product?.prices, input.currency)
          const confirmed = await readCatalogueAmount(pancake, productId, input.currency)
          if (
            !amountsEqual(stored, input.amountCents, input.currency) ||
            !amountsEqual(confirmed, input.amountCents, input.currency)
          ) {
            throw new PaymentError(
              'bad_amount',
              `Waffo price update for ${productId} returned ${confirmed ?? stored ?? 'unknown'}, the page charges ${expected}. Checkout was not opened.`,
            )
          }
        }

        const session = await pancake.checkout.createSession({
          productId,
          currency: input.currency.toUpperCase(),
          // Same number as the stored price. A dropped snapshot then still
          // charges the page price, because the product was aligned above.
          priceSnapshot: {
            amount: expected,
            taxCategory: taxCategoryOf(config.taxCategory),
          },
          // A code would change the amount after the page quoted it.
          allowPromotionCodes: false,
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
            amount_cents: String(input.amountCents),
          },
        })

        const hosted = await readHostedQuote(session.checkoutUrl, config.environment)
        if (
          hosted.productId !== productId ||
          !amountsEqual(hosted.amount, input.amountCents, input.currency)
        ) {
          throw new PaymentError(
            'bad_amount',
            `Hosted checkout locked ${hosted.amount ?? 'unknown'} on ${hosted.productId ?? 'unknown'}, the page charges ${expected} on ${productId}. Checkout was not opened.`,
          )
        }

        return { ref: session.sessionId, url: session.checkoutUrl }
      } catch (err) {
        if (err instanceof PaymentError) throw err
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
      // `chargedAmount` is what the card paid, tax included. `goodsCents` is
      // the pre-tax price. The webhook publishes only when that pre-tax price
      // is the order amount. A large gap is not recorded as tax.
      amountCents: fromAmountString(data.chargedAmount ?? data.amount, currency),
      goodsCents: goodsCentsOf(data),
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

/**
 * The price the hosted page will actually show. The session response itself
 * has no amount; Waffo's checkout bootstrap does.
 */
async function readHostedQuote(
  checkoutUrl: string,
  environment: string,
): Promise<{ amount: string | null; productId: string | null }> {
  const url = new URL(checkoutUrl)
  const parts = url.pathname.split('/').filter(Boolean)
  const slug = parts[1]
  const sessionId = parts[3]
  if (parts[0] !== 'store' || parts[2] !== 'checkout' || !slug || !sessionId) {
    return { amount: null, productId: null }
  }
  const bootstrap = new URL('/api/checkout/bootstrap', url.origin)
  bootstrap.searchParams.set('slug', slug)
  bootstrap.searchParams.set('session', sessionId)
  bootstrap.searchParams.set('env', environment === 'test' ? 'test' : 'prod')
  const res = await fetch(bootstrap)
  if (!res.ok) return { amount: null, productId: null }
  return sessionQuote(await res.json())
}

/** The product's stored price, before a session is created. */
async function readCatalogueAmount(
  pancake: WaffoPancake,
  productId: string,
  currency: string,
): Promise<string | null> {
  const res = await pancake.graphql.query<{ onetimeProduct?: { prices?: unknown } }>({
    query: `query ($id: String!) {
      onetimeProduct(id: $id) { prices { currency priceInfo { amount } } }
    }`,
    variables: { id: productId },
  })
  return catalogueAmount(res.data?.onetimeProduct?.prices, currency)
}

function goodsCentsOf(data: WebhookEventData): number | null {
  const raw = data.listPrice?.subtotal ?? data.subtotal
  if (raw == null || String(raw).trim() === '') return null
  return fromAmountString(String(raw), String(data.currency || 'usd'))
}

function taxCategoryOf(raw: string): TaxCategory {
  const value = raw.trim().toLowerCase()
  return ((TAX_CATEGORIES as readonly string[]).includes(value)
    ? value
    : 'digital_goods') as TaxCategory
}
