/**
 * GET /api/admin/home-pulse — read-only view of what the homepage is selling
 * and listing right now.
 *
 * Prices come from the same `effectiveQuote` checkout uses. Week and month
 * windows are Asia/Shanghai, the same cut as Just launched. Vote counts are
 * the live `votes` table for this ISO week, not the static catalogue number.
 */

import { isAdmin } from '../../utils/admin'
import { useDb } from '../../utils/db'
import { loadOverrides } from '../../utils/overrides'
import { listPublishedTools } from '../../utils/submissions'
import { voteCounts } from '../../utils/votes'
import { effectiveQuote, type PriceKind } from '~~/shared/utils/pricing-effective'
import {
  isoWeekId,
  localizeTool,
  mergeDirectory,
  orderedTools,
} from '~~/shared/utils/catalog'
import {
  filterByWindow,
  shanghaiMonthRange,
  shanghaiWeekRange,
} from '~~/shared/utils/directory-window'

const PRICE_ROWS: { kind: PriceKind; id: string; label: string }[] = [
  { kind: 'listing', id: 'free', label: '免费收录' },
  { kind: 'listing', id: 'standard', label: '标准收录' },
  { kind: 'listing', id: 'featured', label: '精选' },
  { kind: 'listing', id: 'pro', label: '专业' },
  { kind: 'sidebar', id: '1', label: '侧栏 1 周' },
  { kind: 'sidebar', id: '4', label: '侧栏 4 周' },
  { kind: 'billboard', id: 'entry', label: 'Billboard 地板价' },
]

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const now = new Date()
  const db = await useDb(event)
  const [submitted, overrides, counts] = await Promise.all([
    listPublishedTools(db),
    loadOverrides(db),
    voteCounts(db, isoWeekId(now)).catch(() => ({}) as Record<string, number>),
  ])
  const all = mergeDirectory(
    orderedTools('en', overrides),
    submitted.map((tool) => localizeTool(tool, 'en')),
    overrides,
  )
  const week = filterByWindow(all, shanghaiWeekRange(now), (row) => row.created_at)
  const month = filterByWindow(all, shanghaiMonthRange(now), (row) => row.created_at)

  const itemOf = (tool: (typeof all)[number]) => ({
    slug: tool.slug,
    name: tool.name,
    url: tool.url,
    plan: tool.plan || '',
    featured: Boolean(tool.is_featured || (tool.is_paid && (tool.plan === 'featured' || tool.plan === 'pro'))),
    votes: Math.max(Number(tool.votes_week) || 0, Number(counts[tool.slug]) || 0),
    createdAt: tool.created_at,
    shots: tool.shots.length,
  })

  return {
    ok: true as const,
    weekId: isoWeekId(now),
    prices: PRICE_ROWS.map((row) => {
      const quote = effectiveQuote(row.kind, row.id, now.getTime())
      return {
        ...row,
        listLabel: quote.listLabel,
        priceLabel: quote.priceLabel,
        strikeLabel: quote.strikeLabel,
      }
    }),
    week: { count: week.length, items: week.slice(0, 30).map(itemOf) },
    month: { count: month.length, items: month.slice(0, 30).map(itemOf) },
    featured: all
      .filter((tool) => tool.is_paid && (tool.plan === 'featured' || tool.plan === 'pro' || tool.is_featured))
      .slice(0, 12)
      .map(itemOf),
  }
})