/**
 * GET /api/admin/home-pulse — read-only view of what the homepage is selling
 * and listing right now.
 *
 * Prices come from the same `effectiveQuote` checkout uses. "This week" is
 * the UTC ISO weekly board (`loadBoardPayload`), the same list as the
 * homepage. "This month" is still the Asia/Shanghai calendar month, newest
 * first, and is not a vote contest. Vote counts are the live `votes` table.
 */

import { isAdmin } from '../../utils/admin'
import { loadBoardPayload } from '../../utils/board-week'
import { useDb } from '../../utils/db'
import { loadEligibleListedAt } from '../../utils/eligible-listings'
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
} from '~~/shared/utils/directory-window'

const PRICE_ROWS: { kind: PriceKind; id: string; label: string }[] = [
  { kind: 'listing', id: 'free', label: '免费收录' },
  { kind: 'listing', id: 'standard', label: '标准收录' },
  { kind: 'listing', id: 'featured', label: '精选' },
  { kind: 'listing', id: 'pro', label: '专业' },
  { kind: 'sidebar', id: '1', label: '侧栏 1 周' },
  { kind: 'sidebar', id: '4', label: '侧栏 4 周' },
  { kind: 'billboard', id: 'floor', label: 'Billboard 地板价' },
]

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const now = new Date()
  const db = await useDb(event)
  const weekId = isoWeekId(now)
  const [submitted, overrides, counts, eligible] = await Promise.all([
    listPublishedTools(db),
    loadOverrides(db),
    voteCounts(db, weekId).catch(() => ({}) as Record<string, number>),
    loadEligibleListedAt(db),
  ])
  const all = mergeDirectory(
    orderedTools('en', overrides),
    submitted.map((tool) => localizeTool(tool, 'en')),
    overrides,
  )
  const board = await loadBoardPayload(db, weekId, now, eligible)
  const bySlug = new Map(all.map((tool) => [tool.slug, tool]))
  const month = filterByWindow(all, shanghaiMonthRange(now), (row) => row.created_at)

  const itemOf = (tool: (typeof all)[number], votes: number) => ({
    slug: tool.slug,
    name: tool.name,
    url: tool.url,
    plan: tool.plan || '',
    featured: Boolean(tool.is_featured || (tool.is_paid && (tool.plan === 'featured' || tool.plan === 'pro'))),
    votes,
    createdAt: tool.created_at,
    shots: tool.shots.length,
  })

  const weekItems = (board.current?.ranking ?? []).slice(0, 30).map((row) => {
    const tool = bySlug.get(row.slug)
    if (!tool) {
      return {
        slug: row.slug,
        name: row.slug,
        url: '',
        plan: '',
        featured: false,
        votes: row.votes,
        createdAt: '',
        shots: 0,
      }
    }
    return itemOf(tool, row.votes)
  })

  return {
    ok: true as const,
    weekId,
    prices: PRICE_ROWS.map((row) => {
      const quote = effectiveQuote(row.kind, row.id, now.getTime())
      return {
        ...row,
        listLabel: quote.listLabel,
        priceLabel: quote.priceLabel,
        strikeLabel: quote.strikeLabel,
      }
    }),
    week: { count: board.current?.ranking.length ?? 0, items: weekItems },
    month: { count: month.length, items: month.slice(0, 30).map((tool) => itemOf(tool, Number(counts[tool.slug]) || 0)) },
    featured: all
      .filter((tool) => tool.is_paid && (tool.plan === 'featured' || tool.plan === 'pro' || tool.is_featured))
      .slice(0, 12)
      .map((tool) => itemOf(tool, Number(counts[tool.slug]) || 0)),
  }
})