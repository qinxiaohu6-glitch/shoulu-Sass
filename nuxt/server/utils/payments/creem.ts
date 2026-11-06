/**
 * Creem — hosted checkout, HMAC-signed callbacks.
 *
 * Simpler than Waffo in one direction and stricter in the other: creating a
 * checkout is a single REST call with an API key, but Creem's product carries
 * its own price, so a tier cannot be re-priced at checkout time. Each plan
 * therefore needs its own Creem product, and `productIds` is required rather
 * than optional — the source project treats an unmapped product id as a
 * configuration error for exactly this reason.
 *
 * The webhook signature is a plain HMAC-SHA256 of the raw body, hex encoded,
 * compared in constant time. `checkout.completed` is the only event a one-off
 * listing purchase produces.
 *
 * Two things copied from the source's `creem.ts` on purpose:
 *
 * · `request_id` carries our order id. It is Creem's own idempotency key, so a
 *   retried checkout returns the same session instead of a second one.
 * · amounts arrive in minor units already, so they are passed through rather
 *   than converted — the one place a ×100 would silently overcharge.
 */

import { hmacSignHex, timingSafeEqual } from '../crypto'
import { headerOf, PaymentError } from './types'
import type { CheckoutRequest, CheckoutSession, PaymentEvent, PaymentProvider } from './types'

const PRODUCTION_API = 'https://api.creem.io'
const SANDBOX_API = 'https://test-api.creem.io'

const SIGNATURE_HEADER = 'creem-signature'

export interface CreemConfig {
  apiKey: string
  signingSecret: string
  /** `production` charges real cards; anything else is the sandbox host. */
  environment: string
  /** plan slug → Creem product id. */
  productIds: Record<string, string>
}

export function creemProvider(config: CreemConfig): PaymentProvider {
  const configured = () => Boolean(config.apiKey && config.signingSecret)
  const baseUrl = config.environment === 'production' ? PRODUCTION_API : SANDBOX_API

  return {
    id: 'creem',
    configured,

    async createCheckout(input: CheckoutRequest): Promise<CheckoutSession> {
      if (!configured()) throw new PaymentError('not_configured')

      // No wildcard fallback here, unlike Waffo. Creem charges whatever the
      // product costs, so one shared product would sell the $19 tier and the
      // $69 tier at the same price. An unmapped plan must fail loudly.
      const productId = config.productIds[input.plan]
      if (!productId) {
        throw new PaymentError(
          'not_configured',
          `No Creem product id for plan "${input.plan}"`,
        )
      }

      const res = await fetch(`${baseUrl}/v1/checkouts`, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          product_id: productId,
          request_id: input.orderId,
          // Always 1. A second seat is a second checkout, not more units.
          units: 1,
          customer: { email: input.email },
          success_url: input.successUrl,
          metadata: {
            order_id: input.orderId,
            submission_id: input.submissionId,
            plan: input.plan,
          },
        }),
      })

      const payload = (await res.json().catch(() => null)) as
        | { id?: string; checkout_url?: string; error?: { message?: string } | string }
        | null

      if (!res.ok || !payload?.id || !payload?.checkout_url) {
        const detail =
          typeof payload?.error === 'string'
            ? payload.error
            : payload?.error?.message || `HTTP ${res.status}`
        throw new PaymentError('provider_error', detail)
      }

      return { ref: payload.id, url: payload.checkout_url }
    },

    async parseWebhook(
      rawBody: string,
      headers: Record<string, string>,
    ): Promise<PaymentEvent | 'ignored' | null> {
      if (!config.signingSecret) return null

      const provided = headerOf(headers, SIGNATURE_HEADER).trim().toLowerCase()
      if (!provided) return null

      // Hex, not base64 — and over the raw body, so this must run before any
      // JSON parser has touched the request.
      const expected = await hmacSignHex(config.signingSecret, rawBody)
      if (!timingSafeEqual(expected, provided)) return null

      let event: CreemEvent
      try {
        event = JSON.parse(rawBody) as CreemEvent
      } catch {
        return null
      }

      return translate(event) ?? 'ignored'
    },
  }
}

type CreemOrder = {
  id?: string
  transaction?: string
  amount?: number
  amount_paid?: number
  currency?: string
  status?: string
}

type CreemEvent = {
  id?: string
  eventType?: string
  object?: {
    id?: string
    request_id?: string
    status?: string
    metadata?: Record<string, string> | null
    customer?: { id?: string; email?: string; name?: string } | null
    order?: CreemOrder | null
    last_transaction?: CreemOrder | null
  }
}

/**
 * Creem's event vocabulary → ours.
 *
 * `checkout.completed` is the only one that means "a listing was bought".
 * `subscription.*` cannot happen here (nothing on this site recurs) and
 * `refund.created` is left unhandled on purpose: a refund is settled by hand
 * in the console, where the operator can also decide whether to unpublish.
 */
function translate(event: CreemEvent): PaymentEvent | null {
  const object = event.object
  if (!object) return null

  const orderId = object.metadata?.order_id || object.request_id || ''
  if (!orderId) return null

  const order = object.order || object.last_transaction || null
  const providerRef = order?.transaction || order?.id || object.id || ''
  const currency = String(order?.currency || 'usd').toLowerCase()

  if (event.eventType === 'checkout.completed') {
    // `completed` is emitted for the checkout, `paid` for the money. A session
    // that completed without a paid order is a delayed or failed method.
    if (order?.status && order.status !== 'paid') return null

    return {
      orderId,
      providerRef,
      status: 'paid',
      // Minor units already, unlike Waffo's display strings.
      amountCents: Number(order?.amount_paid ?? order?.amount ?? 0),
      currency,
      email: object.customer?.email || '',
      raw: event,
    }
  }

  return null
}
