/**
 * Sealed-cookie primitives: base64url + HMAC-SHA256.
 *
 * Shared by the session cookie and the OAuth state cookie. Both are "a small
 * JSON blob plus a signature", and both must survive a Worker restart — so the
 * only thing the server has to keep is the signing secret.
 *
 * Web Crypto is used rather than `node:crypto` because the same code has to
 * run on Cloudflare Workers.
 */

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of view) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return b64url(sig)
}

/**
 * Same signature, lowercase hex.
 *
 * Webhook signatures are hex (Stripe's is), cookies are base64url (ours are).
 * Both are HMAC-SHA256 over a string; only the encoding differs, and getting it
 * wrong produces a comparison that never matches for a reason no log explains.
 */
export async function hmacSignHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Compare without leaking where the first difference is.
 *
 * The length check is not secret-dependent in a useful way (both sides are
 * HMAC outputs), so returning early on a length mismatch is fine.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** `base64url(json).signature` */
export async function seal(secret: string, obj: Record<string, unknown>): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify(obj)))
  return `${payload}.${await hmacSign(secret, payload)}`
}

/**
 * Verify the signature and return the payload, or null.
 *
 * Expiry is deliberately *not* checked here: the session lives 30 days and the
 * OAuth state 10 minutes, and burying one TTL in a shared helper is how the
 * wrong one gets applied.
 */
export async function unseal(
  secret: string,
  value: string | undefined | null,
): Promise<Record<string, unknown> | null> {
  if (!value || !value.includes('.')) return null
  const idx = value.lastIndexOf('.')
  const payload = value.slice(0, idx)
  const sig = value.slice(idx + 1)
  if (!payload || !sig) return null

  const expected = await hmacSign(secret, payload)
  if (!timingSafeEqual(expected, sig)) return null

  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)))
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
  } catch {
    return null
  }
}
