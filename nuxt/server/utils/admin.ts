/**
 * The owner's console, gated by one shared token.
 *
 * There is no user table and no role column: exactly one person runs this
 * site, so "am I the owner" reduces to "do I know the token". The token is
 * generated once (see README) and stored as a Worker secret; the browser
 * keeps it in an HttpOnly cookie after `/admin?token=…` exchanges it.
 *
 * Two gates, because one is not enough: `/admin` is absent from every nav, and
 * the page refuses to render without the cookie. An unauthorised request gets
 * the ordinary 404 — a 403 would confirm the page exists and tell a scanner
 * exactly where to aim.
 */

import type { H3Event } from 'h3'
import { timingSafeEqual } from './crypto'

export const ADMIN_COOKIE = 'atlas_admin'
export const ADMIN_MAX_AGE = 60 * 60 * 24 * 30

/**
 * `useRuntimeConfig(event)`, never the bare call.
 *
 * On Cloudflare Workers the built server returns the *build-time* config when
 * no event is passed — the compiled helper is literally
 * `useRuntimeConfig(e){ if(!e) return Zn; … applyEnv(…) }`, so the `NUXT_*`
 * secrets are never merged in and every field stays at its default. Passing the
 * event is what triggers the merge. Without it a configured `NUXT_ADMIN_TOKEN`
 * reads back as `''` and `/admin` answers 404 forever, with nothing in the logs.
 */
export function adminToken(event: H3Event): string {
  return String(useRuntimeConfig(event).adminToken || '').trim()
}

/** No token configured means the console does not exist at all. */
export function adminConfigured(event: H3Event): boolean {
  return adminToken(event).length > 0
}

export function isAdmin(event: H3Event): boolean {
  const token = adminToken(event)
  if (!token) return false
  const given = getCookie(event, ADMIN_COOKIE)
  if (!given) return false
  return timingSafeEqual(given, token)
}

/**
 * Answer 404 for a request that may not see the console.
 *
 * Returning the same body a missing route would produce is the point: the
 * status code is the only thing an unauthorised visitor learns.
 */
export function hideFromOutsider(event: H3Event) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
}
