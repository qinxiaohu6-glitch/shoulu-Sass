/**
 * Session cookie: signed, stateless, HttpOnly.
 *
 * The payload is `{ sub, email, name, picture, exp }` sealed with HMAC-SHA256.
 * Nothing secret lives in it, so a stateless token is enough — there is no
 * session table to keep and no read on every request.
 *
 * Google OAuth (`server/routes/auth/*`) is the only thing that mints one.
 */

import type { H3Event } from 'h3'
import { seal, unseal } from './crypto'

export const SESSION_COOKIE = 'atlas_session'
export const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export type Session = {
  sub: string
  email: string
  name?: string
  picture?: string
  exp: number
}

/**
 * The event is required, not optional.
 *
 * On Workers a bare `useRuntimeConfig()` returns the build-time config and
 * never merges `NUXT_*` — so an optional parameter would let a caller silently
 * sign with the published `dev-session-secret`. Making it required turns that
 * into a compile error instead.
 */
function secret(event: H3Event): string {
  return useRuntimeConfig(event).sessionSecret || 'dev-session-secret'
}

export async function createSessionToken(
  event: H3Event,
  user: { sub: string; email: string; name?: string; picture?: string },
  now = Date.now(),
): Promise<string> {
  return seal(secret(event), {
    sub: String(user.sub),
    email: String(user.email || '').toLowerCase(),
    name: user.name ?? '',
    picture: user.picture ?? '',
    exp: Math.floor(now / 1000) + MAX_AGE,
  })
}

/** Verify signature and expiry. Returns null on anything unexpected. */
export async function readSession(event: H3Event): Promise<Session | null> {
  const data = await unseal(secret(event), getCookie(event, SESSION_COOKIE))
  if (!data) return null
  if (!data.sub || typeof data.exp !== 'number') return null
  if (data.exp * 1000 < Date.now()) return null
  return {
    sub: String(data.sub),
    email: String(data.email ?? ''),
    name: String(data.name ?? ''),
    picture: String(data.picture ?? ''),
    exp: data.exp,
  }
}

export function setSessionCookie(event: H3Event, token: string) {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: MAX_AGE,
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

/**
 * Who is voting, in a form we are willing to store.
 *
 * The leaderboard promises "one vote per signed-in user per week", so an
 * anonymous vote cannot be counted — accepting it would make the ranking
 * gameable by a refresh loop.
 */
export async function voterKey(event: H3Event): Promise<string> {
  const me = await readSession(event)
  if (!me) return ''
  if (me.sub) return `sub:${me.sub}`
  return me.email ? `email:${me.email}` : ''
}
