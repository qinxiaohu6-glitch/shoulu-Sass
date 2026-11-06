/**
 * Waffo Pancake — one-off checkout, RSA-SHA256 signed in both directions.
 *
 * The source project uses `@waffo/pancake-ts`, and this file deliberately does
 * not. That SDK imports `node:crypto` (`createSign`, `createVerify`), which a
 * Cloudflare Worker only partially provides; the six fields we actually need
 * are cheaper to sign with Web Crypto than to gamble on a compat shim. The
 * wire format below is copied from the SDK's own source, not guessed:
 *
 *   request   X-Merchant-Id / X-Timestamp / X-Signature
 *             canonical = METHOD \n PATH \n TIMESTAMP \n base64(sha256(body))
 *             X-Signature = base64(RSA-SHA256(canonical, privateKey))
 *
 *   webhook   X-Waffo-Signature: t=<ms>,v1=<base64>
 *             signed input = `${t}.${rawBody}`, verified against Waffo's
 *             platform public key for the configured environment.
 *
 * Three decisions worth knowing:
 *
 * · **Anonymous checkout, not authenticated.** The source's `checkout.authenticated`
 *   path issues a customer session token first, because it has a `customer.id`.
 *   A directory submission here has an email and nothing else, so the single
 *   `create-session` call is the same purchase without inventing an identity.
 *
 * · **The amount is sent, never read.** `priceSnapshot` carries the price the
 *   pricing table produced, so the dashboard product's own price is overridden
 *   and `order.amount_cents` always equals what the buyer was charged.
 *
 * · **The webhook window is 45 minutes, not 5.** Waffo re-signs nothing on a
 *   retry: the last attempt can arrive 31 minutes after the first, so a
 *   5-minute window rejects deliveries Waffo considers valid. Replay is
 *   handled where it belongs — `settleOrder` only moves a row out of
 *   `pending`, so a replayed `order.completed` changes nothing.
 */

import { PaymentError, headerOf } from './types'
import type { CheckoutRequest, CheckoutSession, PaymentEvent, PaymentProvider } from './types'

const API_BASE = 'https://api.waffo.ai'
const CREATE_SESSION_PATH = '/v1/actions/checkout/create-session'

const SIGNATURE_HEADER = 'x-waffo-signature'

/** Waffo retries reuse the original `t`; see the header comment. */
const TOLERANCE_MS = 45 * 60 * 1000
/** The other half of the window: a clock running fast must not pass either. */
const FUTURE_TOLERANCE_MS = 60 * 1000

/**
 * Waffo's platform signing keys, per environment, taken verbatim from
 * `@waffo/pancake-ts@0.18.0` (`src/webhooks.ts`). They are public keys that
 * ship in an open-source package, and they are what every store verifies
 * against — the Dashboard only displays them. A deployment that has been
 * given its own key can override via `webhookPublicKey`.
 */
const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxnmRY6yMMA3lVqmAU6ZG
b1sjL/+r/z6E+ZjkXaDAKiqOhk9rpazni0bNsGXwmftTPk9jy2wn+j6JHODD/WH/
SCnSfvKkLIjy4Hk7BuCgB174C0ydan7J+KgXLkOwgCAxxB68t2tezldwo74ZpXgn
F49opzMvQ9prEwIAWOE+kV9iK6gx/AckSMtHIHpUesoPDkldpmFHlB2qpf1vsFTZ
5kD6DmGl+2GIVK01aChy2lk8pLv0yUMu18v44sLkO5M44TkGPJD9qG09wrvVG2wp
OTVCn1n5pP8P+HRLcgzbUB3OlZVfdFurn6EZwtyL4ZD9kdkQ4EZE/9inKcp3c1h4
xwIDAQAB
-----END PUBLIC KEY-----`

const PROD_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz+xApdTIb4ua+DgZKQ54
iBsD82ybyhGCLRETONW4Jgbb3A8DUM1LqBk6r/CmTOCHqLalTQHNigvP3R5zkDNX
iRJz6gA4MJ/+8K0+mnEE2RISQzN+Qu65TNd6svb+INm/kMaftY4uIXr6y6kchtTJ
dwnQhcKdAL2v7h7IFnkVelQsKxDdb2PqX8xX/qwd01iXvMcpCCaXovUwZsxH2QN5
ZKBTseJivbhUeyJCco4fdUyxOMHe2ybCVhyvim2uxAl1nkvL5L8RCWMCAV55LLo0
9OhmLahz/DYNu13YLVP6dvIT09ZFBYU6Owj1NxdinTynlJCFS9VYwBgmftosSE1U
dwIDAQAB
-----END PUBLIC KEY-----`

/**
 * Currencies whose smallest unit *is* the unit. Waffo sends amounts as display
 * strings ("39.00" or "4500"), so the conversion has to know which ones have no
 * minor unit — dividing JPY by 100 would ask for a ¥0.39 charge.
 */
const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW',
  'PYG', 'RWF', 'UGX', 'UYU', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

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

      const body = JSON.stringify({
        productId,
        currency: input.currency.toUpperCase(),
        // Overrides the dashboard price, so the charge equals the order row.
        priceSnapshot: {
          amount: toAmountString(input.amountCents, input.currency),
          taxCategory: config.taxCategory,
        },
        buyerEmail: input.email,
        successUrl: input.successUrl,
        // Echoed back on every event for this order, refunds included.
        orderMerchantExternalId: input.orderId,
        metadata: {
          order_id: input.orderId,
          submission_id: input.submissionId,
          plan: input.plan,
        },
      })

      const timestamp = Math.floor(Date.now() / 1000).toString()
      const signature = await signRequest(
        config.privateKey,
        'POST',
        CREATE_SESSION_PATH,
        timestamp,
        body,
      )

      const res = await fetch(`${API_BASE}${CREATE_SESSION_PATH}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-merchant-id': config.merchantId,
          'x-timestamp': timestamp,
          'x-signature': signature,
        },
        body,
      })

      const envelope = (await res.json().catch(() => null)) as
        | {
            data?: { sessionId?: string; checkoutUrl?: string }
            errors?: { message?: string }[]
          }
        | null

      const session = envelope?.data
      if (!res.ok || !session?.sessionId || !session?.checkoutUrl) {
        const detail =
          envelope?.errors?.map((e) => e.message).filter(Boolean).join('; ') ||
          `HTTP ${res.status}`
        throw new PaymentError('provider_error', detail)
      }

      return { ref: session.sessionId, url: session.checkoutUrl }
    },

    async parseWebhook(
      rawBody: string,
      headers: Record<string, string>,
    ): Promise<PaymentEvent | 'ignored' | null> {
      const header = headerOf(headers, SIGNATURE_HEADER)
      if (!header) return null

      // `t=1699…,v1=<base64>` — base64 never contains a comma, so splitting on
      // one cannot cut a signature in half.
      const parts = header.split(',').map((piece) => piece.trim())
      const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2) ?? ''
      const signature = parts.find((p) => p.startsWith('v1='))?.slice(3) ?? ''
      if (!timestamp || !signature) return null

      const timestampMs = Number(timestamp)
      if (!Number.isFinite(timestampMs)) return null
      const age = Date.now() - timestampMs
      if (age > TOLERANCE_MS || age < -FUTURE_TOLERANCE_MS) return null

      const signedInput = `${timestamp}.${rawBody}`
      if (!(await verifySignature(config, signedInput, signature))) return null

      let event: WaffoEvent
      try {
        event = JSON.parse(rawBody) as WaffoEvent
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

type WaffoEvent = {
  id?: string
  eventType?: string
  eventId?: string
  mode?: string
  data?: {
    orderId?: string
    orderStatus?: string
    buyerEmail?: string
    currency?: string
    orderMerchantExternalId?: string
    orderMetadata?: Record<string, string> | null
    chargedAmount?: string
    amount?: string
    paymentId?: string
    paymentStatus?: string
    refundedAmount?: string
    refundStatus?: string
  }
}

/**
 * Waffo's event vocabulary → ours.
 *
 * Only a one-off listing is being sold, so two events matter: the money
 * arrived, and the money went back. `subscription.*` and `store.*` return
 * null; subscribing the webhook to them would only produce noise.
 */
function translate(event: WaffoEvent): PaymentEvent | null {
  const data = event.data
  if (!data) return null

  const orderId = data.orderMerchantExternalId || data.orderMetadata?.order_id || ''
  if (!orderId) return null

  const providerRef = data.paymentId || event.id || ''
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
      // the caller refuses to publish and the operator sees why.
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

/* -------------------------------------------------------------------------
   crypto — Web Crypto only, because this file runs on a Worker
------------------------------------------------------------------------- */

/** Import once per isolate rather than once per checkout. */
let privateKeyCache: { pem: string; key: Promise<CryptoKey> } | null = null
let publicKeyCache: { pem: string; key: Promise<CryptoKey> } | null = null

async function signRequest(
  privateKeyPem: string,
  method: string,
  path: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const bodyHash = await sha256Base64(body)
  const canonical = `${method}\n${path}\n${timestamp}\n${bodyHash}`
  const key = await importPrivateKey(privateKeyPem)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(canonical),
  )
  return b64encode(signature)
}

async function verifySignature(
  config: WaffoConfig,
  signedInput: string,
  signatureB64: string,
): Promise<boolean> {
  const candidates = config.webhookPublicKey
    ? [config.webhookPublicKey]
    : config.environment === 'test'
      ? [TEST_PUBLIC_KEY]
      : config.environment === 'prod'
        ? [PROD_PUBLIC_KEY]
        : // Unpinned: the source's SDK tries production first, then test.
          [PROD_PUBLIC_KEY, TEST_PUBLIC_KEY]

  let sig: Uint8Array<ArrayBuffer>
  try {
    sig = b64decode(signatureB64)
  } catch {
    return false
  }

  const data = new TextEncoder().encode(signedInput)
  for (const pem of candidates) {
    try {
      const key = await importPublicKey(pem)
      if (await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data)) return true
    } catch {
      // A malformed key is a configuration problem; trying the next candidate
      // costs nothing and keeps a typo from turning every event into a 400.
    }
  }
  return false
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  if (privateKeyCache?.pem === pem) return privateKeyCache.key
  const key = (async () => {
    const der = pemToDer(pem)
    // Web Crypto only speaks PKCS#8. Waffo's Dashboard hands out PKCS#1
    // (`BEGIN RSA PRIVATE KEY`), which differs only by a fixed header — so it
    // is wrapped rather than sent back to the operator as "wrong format".
    const pkcs8 = isPkcs1(pem) ? pkcs1ToPkcs8(der) : der
    return crypto.subtle.importKey(
      'pkcs8',
      pkcs8,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    )
  })()
  privateKeyCache = { pem, key }
  return key
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  if (publicKeyCache?.pem === pem) return publicKeyCache.key
  const key = crypto.subtle.importKey(
    'spki',
    pemToDer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  publicKeyCache = { pem, key }
  return key
}

async function sha256Base64(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return b64encode(digest)
}

function b64encode(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function b64decode(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/\s+/g, ''))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

function isPkcs1(pem: string): boolean {
  return /-----BEGIN RSA PRIVATE KEY-----/.test(pem)
}

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  return b64decode(body)
}

/**
 * PKCS#1 `RSAPrivateKey` → PKCS#8 `PrivateKeyInfo`.
 *
 *   PrivateKeyInfo ::= SEQUENCE {
 *     version             INTEGER (0),
 *     privateKeyAlgorithm SEQUENCE { OID rsaEncryption, NULL },
 *     privateKey          OCTET STRING   -- the PKCS#1 bytes, unchanged
 *   }
 *
 * Twenty lines of DER rather than a dependency, and no ASN.1 parser: the only
 * variable-length piece is the OCTET STRING wrapping the key we were handed.
 */
function pkcs1ToPkcs8(pkcs1: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const version = new Uint8Array([0x02, 0x01, 0x00])
  const rsaAlgorithm = new Uint8Array([
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  ])
  return derTlv(0x30, concatBytes(version, rsaAlgorithm, derTlv(0x04, pkcs1)))
}

function derTlv(tag: number, body: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const length = derLength(body.length)
  const out = new Uint8Array(1 + length.length + body.length)
  out[0] = tag
  out.set(length, 1)
  out.set(body, 1 + length.length)
  return out
}

function derLength(n: number): Uint8Array<ArrayBuffer> {
  if (n < 0x80) return new Uint8Array([n])
  const bytes: number[] = []
  let value = n
  while (value > 0) {
    bytes.unshift(value & 0xff)
    value >>= 8
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes])
}

function concatBytes(...parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
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
