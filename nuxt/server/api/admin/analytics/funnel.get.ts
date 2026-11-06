/**
 * GET /api/admin/analytics/funnel — signup → checkout → paid, grouped by a
 * traffic dimension.
 *
 * The source builds this from an `analytics_event` table it writes on every
 * signup and checkout, carrying the seven UTM/referrer/country dimensions in
 * the query string. **This build records no such events** — there is no
 * `analytics_event` table in `server/database/schema.sql`, and nothing in the
 * sign-in or checkout paths writes one. Rather than invent a tracking layer
 * the site does not have, the endpoint answers the shape the page expects with
 * an empty report, which is exactly what the source renders before its first
 * event arrives: three zeroed steps and the `admin.analytics.empty` row.
 *
 * `since` is still computed from `range` so the response stays truthful about
 * the window it was asked for.
 */

import { isAdmin } from '../../../utils/admin'

const RANGES: Record<string, number> = {
  '24h': 60 * 60 * 24,
  '7d': 60 * 60 * 24 * 7,
  '30d': 60 * 60 * 24 * 30,
}

const DIMENSIONS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'referrer',
  'country',
] as const

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)
  const range = String(query.range ?? '7d')
  const groupBy = String(query.groupBy ?? 'utm_source')

  return {
    since: new Date(Date.now() - (RANGES[range] ?? RANGES['7d']!) * 1000).toISOString(),
    totals: { signups: 0, checkouts: 0, paid: 0 },
    groupBy: (DIMENSIONS as readonly string[]).includes(groupBy) ? groupBy : 'utm_source',
    rows: [],
    // Every dimension key is present so the filter selects render their
    // "Any" option instead of an empty trigger.
    options: Object.fromEntries(DIMENSIONS.map((dim) => [dim, [] as string[]])),
  }
})
