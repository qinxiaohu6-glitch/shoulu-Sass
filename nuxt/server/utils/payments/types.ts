/**
 * The payment seam.
 *
 * Written before any provider is connected, on purpose. The site already takes
 * money the slow way — the submitter is told to pay, an operator confirms by
 * hand, and `confirmPayment()` publishes the listing — and that path must keep
 * working unchanged. What a provider adds is only the middle: a checkout URL
 * the buyer is sent to, and a signed callback that says the money arrived.
 *
 * So the contract is deliberately small. Anything a specific provider needs
 * (line items, tax, customer objects, metadata conventions) stays inside that
 * provider's file; the rest of the codebase only ever sees these four shapes.
 *
 * Adding a provider is: implement this interface, register it in `index.ts`,
 * add its secrets to `runtimeConfig`. Nothing else in the app should move.
 */

export type PaymentProviderId = 'stripe' | 'waffo' | 'creem' | 'dodo' | 'manual'

/** What the buyer is paying for. Assembled on the server, never trusted from the client. */
export interface CheckoutRequest {
  /** Our order id. Providers echo it back in metadata so the webhook can find the row. */
  orderId: string
  submissionId: string
  plan: string
  /** Minor units. Read from the pricing table, not from the request. */
  amountCents: number
  currency: string
  email: string
  /** What the buyer sees on the provider's page, e.g. "Featured listing — Acme". */
  description: string
  successUrl: string
  cancelUrl: string
}

export interface CheckoutSession {
  /** The provider's own session id — the thing the webhook will name. */
  ref: string
  /** Where to send the browser. */
  url: string
}

export type PaymentEventStatus = 'paid' | 'failed' | 'cancelled' | 'refunded'

/** A verified callback, translated into our vocabulary. */
export interface PaymentEvent {
  orderId: string
  providerRef: string
  status: PaymentEventStatus
  /** What the provider says was charged. Compared against the order before publishing. */
  amountCents: number
  currency: string
  email: string
  raw: unknown
}

export interface PaymentProvider {
  id: PaymentProviderId
  /** True only when every secret this provider needs is present. */
  configured(): boolean
  /** Throws `PaymentError('not_configured')` when `configured()` is false. */
  createCheckout(input: CheckoutRequest): Promise<CheckoutSession>
  /**
   * Verify the signature and translate the payload.
   *
   * Returns `null` when the request is not authentic — the caller answers 400
   * and does nothing. Never throws for a bad signature: an unauthenticated
   * request is a routine event (scanners find webhook URLs), not an error
   * worth a stack trace.
   *
   * Returns `'ignored'` when the signature is good but the event is not one we
   * act on — a subscription event, a payment-intent update, anything outside
   * this site's one-off purchase. That distinction matters: providers disable
   * endpoints that answer 4xx to events they consider delivered, so a genuine
   * event we do not care about must still be a 200. `null` is "not from the
   * provider", `'ignored'` is "from the provider, nothing to do".
   */
  parseWebhook(
    rawBody: string,
    headers: Record<string, string>,
  ): Promise<PaymentEvent | 'ignored' | null>
}

export type PaymentErrorCode =
  | 'not_configured'
  | 'provider_error'
  | 'bad_amount'
  | 'already_paid'
  | 'not_found'

export class PaymentError extends Error {
  constructor(readonly code: PaymentErrorCode, message = '') {
    super(message || code)
    this.name = 'PaymentError'
  }
}

/** Case-insensitive header lookup — h3 hands back a plain object, not a `Headers`. */
export function headerOf(headers: Record<string, string>, name: string): string {
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return String(value)
  }
  return ''
}
