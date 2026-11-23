/**
 * Page-view counting: what counts as a page view, and how a timestamp becomes
 * a bucket.
 *
 * The site had no visitor data at all, so the board's stats strip could only
 * show things we happened to store — how many products exist, how long a review
 * takes. Those are true and nobody cares: what a visitor wants to know, and
 * what a listing buyer is paying for, is whether anyone is actually here.
 *
 * So the numbers are measured rather than assembled. Everything below is pure
 * so the rules can be tested without a database or a request:
 *
 *  * a bucket is one UTC hour, `2026-11-23T20` — fixed width, so SQL can range
 *    scan it as text and "the last 24 hours" is a string comparison;
 *  * a request counts only if it is a page a human would read: not an API call,
 *    not a build asset, not the operator console, not a file download;
 *  * a crawler is not a visitor. Counting Googlebot would inflate the one
 *    number on the site that is supposed to mean something.
 */

/** UTC hour bucket, e.g. `2026-11-23T20`. */
export function hourBucket(at: Date): string {
  return at.toISOString().slice(0, 13)
}

/** The UTC day a bucket belongs to, e.g. `2026-11-23`. */
export function dayOfBucket(bucket: string): string {
  return bucket.slice(0, 10)
}

/**
 * The last `count` hourly buckets, oldest → newest, ending on `at`'s hour.
 *
 * The newest bucket is the *current* hour, which is partial. That is the same
 * convention a traffic chart uses: the line ends at "now", not at the end of
 * the last full hour.
 */
export function recentBuckets(at: Date, count = 24): string[] {
  const hour = Math.floor(at.getTime() / 3_600_000) * 3_600_000
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) out.push(hourBucket(new Date(hour - i * 3_600_000)))
  return out
}

/** Bucket range covering one ISO week: `from` inclusive, `to` exclusive. */
export function weekBucketRange(weekStart: Date): { from: string; to: string } {
  return {
    from: hourBucket(weekStart),
    to: hourBucket(new Date(weekStart.getTime() + 7 * 86_400_000)),
  }
}

/**
 * Paths that are never a page view.
 *
 * `/settings` is skipped on purpose: it is a signed-in visitor's own console,
 * not a page anyone else will ever see, and counting it would put support
 * traffic into a number used to sell placements.
 */
const SKIP_PREFIXES = [
  '/api',
  '/_nuxt',
  '/_payload',
  '/__nuxt',
  '/assets',
  '/admin',
  '/settings',
  '/cdn-cgi',
]

const FILE_RE =
  /\.(?:js|mjs|css|map|png|jpe?g|gif|webp|avif|svg|ico|bmp|woff2?|ttf|otf|eot|txt|xml|json|webmanifest|rss|atom|pdf)$/i

export function isCountablePath(rawPath: string): boolean {
  const path = (rawPath.split('?')[0] ?? '').split('#')[0] ?? ''
  if (!path.startsWith('/')) return false
  for (const prefix of SKIP_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return false
  }
  return !FILE_RE.test(path)
}

/**
 * Crawlers, previews and headless browsers.
 *
 * `!ua` counts as a bot: a request with no user agent is a script. The list is
 * deliberately broad — an unknown robot inflates the traffic figure, and the
 * figure is the product.
 */
const BOT_RE =
  /bot|crawler|spider|crawling|slurp|preview|facebookexternalhit|embedly|pinterest|vkshare|validator|monitor|uptime|pingdom|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|gptbot|chatgpt|claude|anthropic|perplexity|ccbot|inspectiontool|lighthouse|headless|phantomjs|puppeteer|playwright/i

export function isBotUserAgent(userAgent: string | undefined | null): boolean {
  const ua = (userAgent ?? '').trim()
  if (!ua) return true
  return BOT_RE.test(ua)
}

/** `sec-purpose: prefetch` — NuxtLink warming a route nobody opened. */
export function isPrefetch(purpose: string | undefined | null): boolean {
  return (purpose ?? '').toLowerCase().includes('prefetch')
}

/**
 * What the strip prints for a 24-hour window: the series plus its total.
 *
 * Kept here rather than in the component so "the number equals the line" is a
 * testable property — a headline that disagrees with the chart under it is the
 * one thing a stats card cannot do.
 */
export function summarizeHours(series: readonly number[]): {
  views: number
  peak: number
  hasData: boolean
} {
  let views = 0
  let peak = 0
  for (const value of series) {
    const n = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
    views += n
    if (n > peak) peak = n
  }
  return { views, peak, hasData: views > 0 }
}
