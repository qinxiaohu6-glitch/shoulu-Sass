/**
 * Retired routes answer a real 404.
 *
 * These pages were removed deliberately: community, maker profiles, blog,
 * collections, tags and the directory-numbers page were empty or derivative
 * shells that offered readers nothing and diluted the site's footprint.
 *
 * A soft 404 (HTTP 200 with an "empty" or "gone" body) would keep dead URLs in
 * Google's index. So would a 301 to the homepage — that tells Google the page
 * merely moved. The only signal that removes a URL from the index is a genuine
 * 404/410, which is what this middleware returns, for every language prefix
 * and every legacy `.html` spelling.
 *
 * Order: after 01-legacy-urls (so an old product `.html` still redirects) and
 * before anything that would render a page. Matched paths never reach Nuxt's
 * route table.
 */

const RETIRED = [
  /^\/community(?:\/|$)/,
  /^\/makers(?:\/|$)/,
  /^\/blog(?:\/|$)/,
  /^\/collections(?:\/|$)/,
  /^\/tags(?:\/|$)/,
] as const

/** Strip the /zh prefix and a trailing `.html`, so one rule covers both locales. */
function normalize(pathname: string): string {
  let p = pathname
  if (p === '/zh' || p.startsWith('/zh/')) p = p.slice(3) || '/'
  if (/\.html$/i.test(p)) p = p.slice(0, -'.html'.length) || '/'
  return p
}

export default defineEventHandler((event) => {
  const path = normalize(getRequestURL(event).pathname)
  if (RETIRED.some((re) => re.test(path))) {
    setResponseStatus(event, 404)
    return { statusCode: 404, statusMessage: 'Not Found' }
  }
})
