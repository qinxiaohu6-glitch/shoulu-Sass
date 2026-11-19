/**
 * GET /api/admin/spotlights?status=pending — the Spotlight review queue.
 *
 * Richer than the public list by exactly two fields: the submitter's address
 * (so a rejection can be explained to them) and the owner's notes. Which is why
 * an unauthorised request gets the ordinary 404 rather than a 403.
 *
 * Each row also carries the listing's plan. A Spotlight is sold as part of the
 * Featured and Pro tiers, but the submit form does not enforce that — a writer
 * with a free listing can still send a draft, and the honest place to catch it
 * is here, where the owner is looking at the article anyway. The badge says
 * "not covered by this listing's plan"; it does not block the decision.
 */

import { isAdmin } from '../../utils/admin'
import { useDb } from '../../utils/db'
import { listSpotlights, spotlightStats } from '../../utils/spotlights'
import { planIncludesSpotlight } from '~~/shared/content/spotlights'
import { tools } from '~~/shared/utils/catalog'

type PlanInfo = { plan: string; paid: boolean; entitled: boolean }

/**
 * The plan behind each listing slug, for the badge.
 *
 * Two sources, in order. A community listing has a `submissions` row and that
 * row is the truth — it carries both the plan and whether the money arrived.
 * A curated catalogue entry has no row at all, so its `is_featured` flag is the
 * best available answer; without that fallback the column would read "—" for
 * every one of the seeded listings, which is most of the ones a maker would
 * write about.
 *
 * Chunked at 90 binds: D1 caps a statement at 100 parameters, and a queue of a
 * few hundred rows would silently truncate rather than fail.
 */
async function plansFor(
  db: Awaited<ReturnType<typeof useDb>>,
  slugs: string[],
): Promise<Map<string, PlanInfo>> {
  const out = new Map<string, PlanInfo>()
  const unique = [...new Set(slugs.filter(Boolean))]
  for (let i = 0; i < unique.length; i += 90) {
    const chunk = unique.slice(i, i + 90)
    const marks = chunk.map(() => '?').join(',')
    try {
      const { results } = await db
        .prepare(`SELECT slug, plan, paid_at FROM submissions WHERE slug IN (${marks})`)
        .bind(...chunk)
        .all<{ slug: string; plan: string; paid_at: number | null }>()
      for (const row of results ?? []) {
        if (out.has(row.slug)) continue
        const plan = String(row.plan || 'free')
        out.set(row.slug, {
          plan,
          paid: Boolean(row.paid_at),
          entitled: planIncludesSpotlight(plan) && Boolean(row.paid_at),
        })
      }
    } catch (err) {
      // The badge is a convenience. A missing one must not blank the queue.
      console.error('[admin-spotlights] plan lookup', err)
    }
  }

  for (const slug of unique) {
    if (out.has(slug)) continue
    const tool = tools.find((item) => item.slug === slug)
    if (!tool) continue
    out.set(slug, {
      plan: tool.is_featured ? 'featured' : tool.is_paid ? 'standard' : 'free',
      paid: tool.is_paid,
      entitled: tool.is_featured,
    })
  }

  return out
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const status = String(getQuery(event).status ?? '').trim() || null
  const db = await useDb(event)
  const rows = await listSpotlights(db, status)
  const plans = await plansFor(db, rows.map((row) => row.listingSlug))

  return {
    ok: true,
    items: rows.map((row) => ({ ...row, plan: plans.get(row.listingSlug) ?? null })),
    stats: await spotlightStats(db),
  }
})
