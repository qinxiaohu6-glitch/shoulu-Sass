/**
 * GET /auth/google/callback — Google sends the visitor back here.
 *
 * The order of checks matters:
 *
 *  1. the sealed state cookie must be present, unmodified and fresh, and its
 *     nonce must match the `state` on the query string — this is the CSRF
 *     guard *and* the open-redirect guard, since the destination lives inside
 *     the sealed blob rather than in a URL a third party could edit;
 *  2. `error` means the visitor backed out at Google's consent screen, which is
 *     a decision rather than a failure — but an expired state cookie and a
 *     missing code are separate cases and get separate messages;
 *  3. only then do we spend the code.
 *
 * A refused exchange is reported with its reason (`bad_code`, `bad_client`,
 * `network`, …). That distinction is the whole diagnosis when the owner is
 * wiring the client up, so it rides back to the page as `?why=`.
 */

import {
  AuthError,
  clearStateCookie,
  exchange,
  readState,
  STATE_COOKIE,
  type GoogleUser,
} from '../../../utils/oauth'
import { createSessionToken, setSessionCookie } from '../../../utils/session'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const query = getQuery(event)
  const state = String(query.state ?? '')
  const code = String(query.code ?? '')
  const denied = Boolean(query.error)

  // Three ways to arrive here without a usable code, and they are not the
  // same story to the person reading the message:
  //
  //   * `error=access_denied` — they pressed "cancel" on Google's screen. That
  //     is a decision; telling them the link expired would be a lie.
  //   * no usable state cookie — the round trip took longer than 10 minutes, or
  //     it started in another browser/tab. Nothing they did was wrong, but the
  //     attempt is dead and they have to start over.
  //   * a valid state and still no code — Google answered with neither. Rare,
  //     and worth its own generic "did not complete".
  //
  // Collapsing all three into one message was the original behaviour, and it
  // told people who had simply waited too long that they cancelled.
  const saved = await readState(event, getCookie(event, STATE_COOKIE), state)
  if (denied) {
    clearStateCookie(event)
    return sendRedirect(event, '/sign-in?auth=denied', 302)
  }
  if (!saved) {
    clearStateCookie(event)
    return sendRedirect(event, '/sign-in?auth=bad_code', 302)
  }
  if (!code) {
    clearStateCookie(event)
    return sendRedirect(event, '/sign-in?auth=failed', 302)
  }

  let user: GoogleUser
  try {
    user = await exchange(event, code, getRequestURL(event).origin)
  } catch (err) {
    const reason = err instanceof AuthError ? err.reason : 'failed'
    // Visible in `wrangler tail` / the Nuxt console; the visitor only sees the
    // reason code, which is what the sign-in page turns into a sentence.
    console.error(`[auth] google exchange failed: ${reason}`, err instanceof AuthError ? err.detail : err)
    clearStateCookie(event)
    return sendRedirect(event, `/sign-in?auth=failed&why=${encodeURIComponent(reason)}`, 302)
  }

  setSessionCookie(event, await createSessionToken(event, user))
  clearStateCookie(event)
  return sendRedirect(event, saved.t, 302)
})
