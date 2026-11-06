/**
 * GET /auth/google/start?next=<path>
 *
 * The first leg of the round trip. Two things happen here and nothing else:
 * mint a state cookie that remembers where the visitor wanted to land, then
 * hand them to Google with that state on the query string.
 *
 * When the client credentials are missing we say so on the sign-in page rather
 * than sending the visitor to Google with an empty `client_id` — Google's own
 * error page ("invalid_request") tells them nothing they can act on, and the
 * person who has to fix it is the site owner, not the visitor.
 */

import {
  authorizeUrl,
  clearStateCookie,
  makeState,
  oauthConfigured,
  safeTarget,
  setStateCookie,
} from '../../../utils/oauth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  const query = getQuery(event)
  const target = safeTarget(query.next)

  if (!oauthConfigured(event)) {
    clearStateCookie(event)
    return sendRedirect(event, '/sign-in?auth=unconfigured', 302)
  }

  const { nonce, cookie } = await makeState(event, target)
  setStateCookie(event, cookie)

  let url: string
  try {
    url = authorizeUrl(event, nonce, getRequestURL(event).origin)
  } catch {
    // The credentials were readable a moment ago, so this is a race rather
    // than a missing setting — the visitor gets the same advice either way.
    clearStateCookie(event)
    return sendRedirect(event, '/sign-in?auth=unconfigured', 302)
  }

  return sendRedirect(event, url, 302)
})
