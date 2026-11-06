/**
 * One host, one protocol, one address.
 *
 * Cloudflare serves whichever hostname is bound to the Worker, so after the
 * cutover both `dirtool.com` and `www.dirtool.com` answered 200 with byte-identical
 * HTML. The canonical tag already told crawlers which one counts, but a canonical
 * tag is a hint — a 301 is a fact. It also keeps the two copies from diverging
 * in a cache, and it is what a visitor who types `www.` should get.
 *
 * Plain `http://` is redirected for the same reason plus one more: without it the
 * session and admin cookies would travel in the clear on the first hop. Cookies
 * are already `secure`, so that hop would simply fail to log anyone in — a
 * confusing outcome that a redirect removes.
 *
 * Preview hosts stay reachable (`beta.dirtool.com` is how this deployment was
 * verified) but are marked `noindex`: they serve the same pages as the apex and
 * must not compete with it in a search result.
 */

import type { H3Event } from 'h3'

const CANONICAL_HOST = 'dirtool.com'

/** The apex plus any subdomain of it — but not a lookalike like `dirtool.com.evil`. */
const UNDER_APEX = /^(?:[a-z0-9-]+\.)*dirtool\.com$/i

/**
 * 301 tells a client "this moved permanently", which for a POST means "re-issue
 * it as a GET and drop the body". 308 keeps the method and body. Redirecting a
 * form submission with 301 would silently discard the submission, so non-GET
 * requests get 308.
 */
function redirectStatus(event: H3Event): 301 | 308 {
  const method = String(event.method || 'GET').toUpperCase()
  return method === 'GET' || method === 'HEAD' ? 301 : 308
}

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const headers = getRequestHeaders(event)

  const host = String(headers.host || headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase()
  if (!host) return

  // `x-forwarded-proto` is what the edge actually terminated; the URL protocol is
  // the fallback for local dev, where there is no edge to ask.
  const proto = String(headers['x-forwarded-proto'] || url.protocol || '')
    .split(',')[0]
    .trim()
    .replace(/:$/, '')
    .toLowerCase()

  const path = `${url.pathname}${url.search}`

  // www → apex. Identical content, so the extra host is pure duplication.
  if (host === `www.${CANONICAL_HOST}`) {
    return sendRedirect(event, `https://${CANONICAL_HOST}${path}`, redirectStatus(event))
  }

  if (!UNDER_APEX.test(host)) {
    // `*.workers.dev` and `localhost` are not part of the public site.
    if (host.endsWith('.workers.dev')) setHeader(event, 'x-robots-tag', 'noindex, nofollow')
    return
  }

  if (proto === 'http') {
    return sendRedirect(event, `https://${host}${path}`, redirectStatus(event))
  }

  // Reached only by a preview host such as `beta.dirtool.com`.
  if (host !== CANONICAL_HOST) setHeader(event, 'x-robots-tag', 'noindex, nofollow')
})
