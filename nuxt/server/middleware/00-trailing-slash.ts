/**
 * A trailing slash answers a 301, not a page.
 *
 * Every route on this site also answered `/path/` with a 200, and each of those
 * copies declared itself canonical. That is not a duplicate a canonical tag can
 * consolidate — it is two addresses for one document, both claiming to be the
 * original. The sitemap listed half of them.
 *
 * Order matters: after `00-retired-routes`, so `/blog/` is still a 404 rather
 * than a redirect that ends at one, and before `01-legacy-urls`, so a legacy
 * `.html` path is matched once instead of once per spelling.
 */

import type { H3Event } from 'h3'
import { withoutTrailingSlash } from '~~/shared/utils/trailing-slash'

/**
 * 301 tells a client "this moved permanently", which for a POST means "re-issue
 * it as a GET and drop the body". 308 keeps the method and body — same rule as
 * 00-canonical-host.ts, and for the same reason.
 */
function redirectStatus(event: H3Event): 301 | 308 {
  const method = String(event.method || 'GET').toUpperCase()
  return method === 'GET' || method === 'HEAD' ? 301 : 308
}

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const target = withoutTrailingSlash(url.pathname)
  if (!target) return

  // `?` is carried over: a campaign tag on a slashed link should survive the hop.
  return sendRedirect(event, `${target}${url.search}`, redirectStatus(event))
})
