/**
 * The old site published every page as a file.
 *
 * `/pricing.html`, `/tools/claude.html`, `/zh/categories/audio.html` — those
 * were the live URLs, they were what `canonical` pointed at, and they are what
 * search results and inbound links still use. The new site serves the same
 * pages at clean paths, so without this every one of those addresses answers
 * 404: a site that was indexed yesterday loses its whole footprint overnight.
 *
 * A 301, not a 404 with a "go to the homepage" link. The content did not
 * disappear, it moved — and only a permanent redirect transfers the ranking
 * instead of dropping it.
 *
 * `/dashboard.html` is the one entry that is not a straight rename: the old
 * dashboard was replaced by `/settings/submissions`, so it maps there. The
 * extensionless `/dashboard` is accepted too, because that is the form people
 * type and the form the old build linked to from its own pages.
 *
 * The `.html` suffix is stripped before the dashboard lookup, not after. Doing
 * it the other way round made `/dashboard.html` land on `/dashboard`, which
 * then redirected again — two hops for one move, and a redirect chain is the
 * one thing a crawler will complain about.
 */

import { productRedirect } from '~~/shared/utils/product-routes'

const HTML_SUFFIX = /\.html$/i
const DASHBOARD = new Set(['/dashboard', '/zh/dashboard'])

/** Trailing slashes are optional in a typed URL and were absent in the files. */
function stripSlash(pathname: string): string {
  if (pathname.length <= 1) return pathname
  return pathname.replace(/\/+$/, '') || '/'
}

/** The clean URL for a legacy path, or `null` when the path is not legacy. */
function legacyTarget(pathname: string): string | null {
  const isHtml = HTML_SUFFIX.test(pathname)
  const withoutHtml = isHtml ? pathname.slice(0, -'.html'.length) : pathname
  const bare = stripSlash(withoutHtml)

  if (DASHBOARD.has(bare)) {
    return bare.startsWith('/zh') ? '/zh/settings/submissions' : '/settings/submissions'
  }

  if (!isHtml) return null

  // Directory indexes: `/index.html`, `/zh/index.html`, `/settings/index.html`.
  if (bare === '/index' || bare.endsWith('/index')) {
    return bare.slice(0, -'/index'.length) || '/'
  }

  // The old 404 page has no successor at `/404`; home is the useful answer.
  if (bare === '/404' || bare.endsWith('/404')) {
    return bare.startsWith('/zh') ? '/zh' : '/'
  }

  return productRedirect(bare) ?? bare || '/'
}

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const target = legacyTarget(url.pathname)

  if (!target || target === url.pathname) return

  // `?` is carried over: campaign tags on an old link should survive the hop.
  return sendRedirect(event, `${target}${url.search}`, 301)
})
