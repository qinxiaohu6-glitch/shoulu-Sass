/**
 * `/admin?token=…` → set the cookie, then strip the token from the URL.
 *
 * The token never stays in the address bar. If it did it would live in browser
 * history, in the Referer of any link clicked from the console, and in every
 * proxy log on the way — which defeats the point of it being a secret.
 *
 * A wrong token is not told apart from a missing one: both just land on
 * `/admin`, which answers 404.
 */

import { ADMIN_COOKIE, ADMIN_MAX_AGE, adminToken, isAdmin } from '../utils/admin'
import { timingSafeEqual } from '../utils/crypto'

const ADMIN_PREFIXES = ['/admin', '/zh/admin']

/**
 * Prefix, not equality: the console grew from one page to five, and a gate
 * that only knows `/admin` would leave `/admin/tools` wide open while looking
 * perfectly fine. The trailing slash in the check keeps `/administrator` out.
 */
function isConsolePath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (!isConsolePath(url.pathname)) return

  const given = String(url.searchParams.get('token') || '').trim()
  if (given) {
    const token = adminToken(event)
    if (token && timingSafeEqual(given, token)) {
      setCookie(event, ADMIN_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: !import.meta.dev,
        path: '/',
        maxAge: ADMIN_MAX_AGE,
      })
    }
    return sendRedirect(event, url.pathname, 302)
  }

  // No token in the URL and no valid cookie: the page does not exist. A 403
  // would confirm it does and tell a scanner where to aim.
  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
})

