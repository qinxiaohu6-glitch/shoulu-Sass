/**
 * Stripe Checkout — implemented, but switched off until the keys exist.
 *
 * This file is complete on purpose rather than a stub. The shape of Stripe's
 * Checkout Session API and its webhook signature scheme are stable and
 * documented, so writing them now means the day the account is approved the
 * work is "paste three secrets, run one test payment", not "start from here".
 *
 * What is NOT verified: nothing here has been run against a live account. When
 * the keys arrive, the first thing to do is a test-mode payment end to end and
 * a `stripe listen --forward-to` webhook. Until then treat this as unproven.
 *
 * Two decisions worth knowing:
 *
 * · The amount comes from `CheckoutRequest`, which the caller built from the
 *   pricing table. Stripe is told what to charge; it is never asked.
 * · `client_reference_id` carries our order id. It survives the round trip
 *   without depending on metadata, and metadata is echoed too so either one
 *   can be used to find the row.
 */

import { hmacSignHex, timingSafeEqual } from '../crypto'
import { headerOf, PaymentError } from './types'
import type { CheckoutRequest, CheckoutSession, PaymentEvent, PaymentProvider } from './types'

const API = 'https://api.stripe.com/v1/checkout/sessions'

/** Five minutes, the tolerance Stripe's own libraries use. */
const TOLERANCE_SECONDS = 300

export interface StripeConfig {
  secretKey: string
  webhookSecret: string
}

export function stripeProvider(config: StripeConfig): PaymentProvider {
  const configured = () => Boolean(config.secretKey && config.webhookSecret)

  return {
    id: 'stripe',
    configured,

    async createCheckout(input: CheckoutRequest): Promise<CheckoutSession> {
      if (!configured()) throw new PaymentError('not_configured')

      // Stripe wants `application/x-www-form-urlencoded`, with brackets for
      // nesting. Building it by hand keeps this file dependency-free — a Stripe
      // SDK in a Worker is 200 KB for six fields.
      const form = new URLSearchParams({
        mode: 'payment',
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        customer_email: input.email,
        client_reference_id: input.orderId,
        'metadata[order_id]': input.orderId,
        'metadata[submission_id]': input.submissionId,
        'metadata[plan]': input.plan,
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': input.currency,
        'line_items[0][price_data][unit_amount]': String(input.amountCents),
        'line_items[0][price_data][product_data][name]': input.description,
      })

      const res = await fetch(API, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.secretKey}`,
          'content-type': 'application/x-www-form-urlencoded',
          // Stripe rejects a request without a version it recognises, and the
          // default changes under you. Pinned deliberately.
          'stripe-version': '2024-06-20',
        },
        body: form.toString(),
      })

      const payload = (await res.json().catch(() => null)) as
        | { id?: string; url?: string; error?: { message?: string } }
        | null

      if (!res.ok || !payload?.id || !payload?.url) {
        // The provider's own message is the only useful diagnostic here, so it
        // goes into the thrown error rather than being flattened to "failed".
        throw new PaymentError('provider_error', payload?.error?.message || `HTTP ${res.status}`)
      }

      return { ref: payload.id, url: payload.url }
    },

    async parseWebhook(
      rawBody: string,
      headers: Record<string, string>,
    ): Promise<PaymentEvent | 'ignored' | null> {
      if (!config.webhookSecret) return null

      const header = headerOf(headers, 'stripe-signature')
      if (!header) return null

      // `t=1699…,v1=ab12…,v1=cd34…` — several v1 entries are legitimate during
      // a secret rotation, so any match wins.
      const parts = header.split(',').map((piece) => piece.trim())
      const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2) ?? ''
      const signatures = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3))
      if (!timestamp || !signatures.length) return null

      const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
      if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return null

      const expected = await hmacSignHex(config.webhookSecret, `${timestamp}.${rawBody}`)
      if (!signatures.some((sig) => timingSafeEqual(expected, sig))) return null

      let event: StripeEvent
      try {
        event = JSON.parse(rawBody) as StripeEvent
      } catch {
        return null
      }

      return translate(event) ?? 'ignored'
    },
  }
}

type StripeObject = {
  id?: string
  object?: string
  client_reference_id?: string | null
  payment_status?: string
  amount_total?: number | null
  currency?: string
  customer_details?: { email?: string | null } | null
  metadata?: Record<string, string> | null
  payment_intent?: string | null
}

type StripeEvent = {
  id?: string
  type?: string
  data?: { object?: StripeObject }
}

/**
 * Stripe's event vocabulary → ours.
 *
 * Only four things matter to a one-off listing purchase: it was paid, it
 * expired, the card was declined, or it was refunded. Everything else
 * (`checkout.session.created`, `payment_intent.processing`, …) returns null and
 * the caller answers 200 without touching the order — a webhook endpoint that
 * 400s on events it does not care about gets disabled by Stripe.
 */
function translate(event: StripeEvent): PaymentEvent | null {
  const object = event.data?.object
  if (!object) return null

  const orderId = object.client_reference_id || object.metadata?.order_id || ''
  if (!orderId) return null

  const providerRef = object.id || ''
  const email = object.customer_details?.email || ''
  const amountCents = Number(object.amount_total ?? 0)
  const currency = String(object.currency || 'usd')

  if (event.type === 'checkout.session.completed') {
    // `completed` fires for delayed payment methods before the money settles.
    // Publishing on that would put a listing live against an unpaid invoice.
    if (object.payment_status !== 'paid') return null
    return { orderId, providerRef, status: 'paid', amountCents, currency, email, raw: event }
  }

  if (event.type === 'checkout.session.expired') {
    return { orderId, providerRef, status: 'cancelled', amountCents, currency, email, raw: event }
  }

  if (event.type === 'checkout.session.async_payment_failed') {
    return { orderId, providerRef, status: 'failed', amountCents, currency, email, raw: event }
  }

  if (event.type === 'charge.refunded') {
    return { orderId, providerRef, status: 'refunded', amountCents, currency, email, raw: event }
  }

  return null
}
