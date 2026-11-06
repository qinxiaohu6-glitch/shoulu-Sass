/**
 * GET /auth/logout?next=<path>
 *
 * Signing out is just deleting a cookie — the session is stateless, so there
 * is nothing server-side to revoke. That is a deliberate trade: a stolen
 * cookie stays valid until it expires, which is why the lifetime is 30 days
 * and the payload carries nothing but the public profile.
 */

import { safeTarget } from '../../utils/oauth'
import { clearSessionCookie } from '../../utils/session'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  clearSessionCookie(event)
  return sendRedirect(event, safeTarget(getQuery(event).next), 302)
})
