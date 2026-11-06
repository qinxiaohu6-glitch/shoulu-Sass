/**
 * Google OAuth 2.0, authorization-code flow.
 *
 * Ported from the old `auth.py`. The parts worth keeping:
 *
 *  * `next` rides in a **sealed state cookie**, not in the URL, so the callback
 *    cannot be turned into an open redirect by editing the query string;
 *  * the ID token's signature is not verified locally — it arrived over TLS
 *    from Google's token endpoint in the same request that carried our client
 *    secret, which is the case Google documents as not needing it. `aud`,
 *    `iss` and `exp` *are* checked, because those catch a token minted for a
 *    different client or replayed later;
 *  * a refused exchange is reported with a reason the owner can act on
 *    ("bad_client" vs "network"), not a generic failure.
 */

import type { H3Event } from 'h3'
import { b64url, fromB64url, seal, unseal } from './crypto'

export const STATE_COOKIE = 'atlas_oauth'
const STATE_TTL = 600 // 10 minutes: enough to pick an account

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com']

/**
 * The two endpoints can be pointed elsewhere.
 *
 * The old Python build read `GOOGLE_AUTH_URL` / `GOOGLE_TOKEN_URL` from the
 * environment for exactly one reason: to run the flow against a local stub and
 * prove the callback handles a refusal, a replay and a bad audience without
 * needing a live client. Same seam here — empty means the real Google.
 */
function authUrl(event: H3Event): string {
  return String(useRuntimeConfig(event).googleAuthUrl || '') || AUTH_URL
}
function tokenUrl(event: H3Event): string {
  return String(useRuntimeConfig(event).googleTokenUrl || '') || TOKEN_URL
}

export class AuthError extends Error {
  constructor(
    public reason: string,
    public detail = '',
  ) {
    super(reason)
  }
}

/* -------------------------------------------------------------------------
   configuration
   ------------------------------------------------------------------------- */

export type OAuthConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/**
 * Every reader below takes the event, for the reason spelled out in
 * `utils/admin.ts`: without it Workers returns the build-time config and the
 * `NUXT_GOOGLE_*` / `NUXT_SESSION_SECRET` secrets never arrive. The client id
 * would read back as `''`, so the console would report "OAuth not configured"
 * on a site whose secrets are all present.
 */
function cfg(event: H3Event): OAuthConfig | null {
  const rc = useRuntimeConfig(event)
  const clientId = String(rc.googleClientId || '').trim()
  const clientSecret = String(rc.googleClientSecret || '').trim()
  if (!clientId || !clientSecret) return null
  return {
    clientId,
    clientSecret,
    redirectUri: String(rc.googleRedirectUri || '').trim(),
  }
}

export const oauthConfigured = (event: H3Event) => cfg(event) !== null

/* -------------------------------------------------------------------------
   post-login destination
   ------------------------------------------------------------------------- */

/**
 * Only a same-site absolute path survives.
 *
 * The old site required a `.html` suffix because it was a static build; Nuxt
 * routes have no suffix, so the rule is now "starts with one slash, contains
 * no scheme, no backslash, no `..`". Anything else falls back to the homepage
 * rather than becoming a redirect to someone else's site.
 */
export function safeTarget(raw: unknown): string {
  const target = String(raw ?? '').trim()
  if (!target || target.length > 400) return '/'
  if (!target.startsWith('/')) return '/'
  if (target.startsWith('//')) return '/'
  if (target.includes('\\') || target.includes('\0')) return '/'
  // Strip the origin if someone passed an absolute URL that happens to start
  // with the site root.
  const path = target.split('?')[0]!
  if (path.includes('//')) return '/'
  if (path.split('/').some((seg) => seg === '..' || seg === '.')) return '/'
  return target
}

/* -------------------------------------------------------------------------
   state cookie
   ------------------------------------------------------------------------- */

function secret(event: H3Event): string {
  return useRuntimeConfig(event).sessionSecret || 'dev-session-secret'
}

export async function makeState(
  event: H3Event,
  target: string,
): Promise<{ nonce: string; cookie: string }> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(18)))
  const cookie = await seal(secret(event), {
    n: nonce,
    t: safeTarget(target),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL,
  })
  return { nonce, cookie }
}

/** Returns the stored payload only when the nonce matches and it has not expired. */
export async function readState(
  event: H3Event,
  cookieValue: string | undefined,
  nonce: string,
): Promise<{ t: string } | null> {
  const data = await unseal(secret(event), cookieValue)
  if (!data) return null
  if (String(data.n ?? '') !== String(nonce ?? '')) return null
  if (Number(data.exp ?? 0) * 1000 < Date.now()) return null
  return { t: safeTarget(data.t) }
}

export function setStateCookie(event: H3Event, value: string) {
  setCookie(event, STATE_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: STATE_TTL,
  })
}

export function clearStateCookie(event: H3Event) {
  deleteCookie(event, STATE_COOKIE, { path: '/' })
}

/* -------------------------------------------------------------------------
   the two network steps
   ------------------------------------------------------------------------- */

export function authorizeUrl(event: H3Event, state: string, origin: string): string {
  const conf = cfg(event)
  if (!conf) throw new AuthError('unconfigured')
  const params = new URLSearchParams({
    client_id: conf.clientId,
    redirect_uri: conf.redirectUri || `${origin}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    include_granted_scopes: 'true',
  })
  return `${authUrl(event)}?${params.toString()}`
}

export type GoogleUser = {
  sub: string
  email: string
  name: string
  picture: string
}

/** Swap the code for tokens and return the identity claims. */
export async function exchange(event: H3Event, code: string, origin: string): Promise<GoogleUser> {
  const conf = cfg(event)
  if (!conf) throw new AuthError('unconfigured')

  let res: Response
  try {
    res = await fetch(tokenUrl(event), {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams({
        code,
        client_id: conf.clientId,
        client_secret: conf.clientSecret,
        redirect_uri: conf.redirectUri || `${origin}/auth/google/callback`,
        grant_type: 'authorization_code',
      }).toString(),
      signal: AbortSignal.timeout(12_000),
    })
  } catch (err) {
    // Never reached Google at all: DNS, firewall, blocked egress.
    throw new AuthError('network', String(err))
  }

  if (!res.ok) {
    // Google answered and refused. Split the refusal into the cases that mean
    // different things to whoever is wiring this up: a stale code (normal), a
    // wrong secret, or a redirect_uri that does not match the registered one.
    const text = await res.text().catch(() => '')
    let reason = 'token_rejected'
    try {
      const err = String(JSON.parse(text).error || '')
      const map: Record<string, string> = {
        invalid_grant: 'bad_code',
        invalid_client: 'bad_client',
        redirect_uri_mismatch: 'redirect_mismatch',
        unauthorized_client: 'bad_client',
      }
      reason = map[err] ?? (err ? `google_${err.slice(0, 24)}` : reason)
    } catch {
      /* keep the generic reason */
    }
    throw new AuthError(reason, `HTTP ${res.status} ${text.slice(0, 300)}`)
  }

  const payload = (await res.json().catch(() => null)) as { id_token?: string } | null
  if (!payload?.id_token) throw new AuthError('no_id_token')
  return claimsFromIdToken(payload.id_token, conf.clientId)
}

export function claimsFromIdToken(idToken: string, clientId: string): GoogleUser {
  let claims: Record<string, unknown>
  try {
    const parts = idToken.split('.')
    if (parts.length < 2) throw new Error('not a jwt')
    claims = JSON.parse(new TextDecoder().decode(fromB64url(parts[1]!)))
  } catch {
    throw new AuthError('bad_id_token')
  }

  if (claims.aud !== clientId) throw new AuthError('audience_mismatch')
  if (!ISSUERS.includes(String(claims.iss ?? ''))) throw new AuthError('issuer_mismatch')
  if (Number(claims.exp ?? 0) * 1000 <= Date.now()) throw new AuthError('token_expired')
  if (!claims.sub) throw new AuthError('no_subject')
  if (claims.email && claims.email_verified === false) throw new AuthError('email_unverified')

  return {
    sub: String(claims.sub),
    email: String(claims.email ?? ''),
    name: String(claims.name ?? ''),
    picture: String(claims.picture ?? ''),
  }
}
