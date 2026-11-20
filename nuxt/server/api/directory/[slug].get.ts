/**
 * GET /api/directory/:slug — one listing, database first, catalogue second.
 *
 * The detail page used to answer curated slugs straight from the static import
 * and only call the server on a miss. That was right while the catalogue was
 * immutable: thirty pages, zero round trips. Now that an operator can edit a
 * listing, the import is no longer authoritative, so the page has to ask.
 *
 * `source` is returned rather than inferred: the page needs to know whether the
 * listing is a curated one (which has a maker page and a paid badge) or a
 * community submission, and a slug alone cannot tell it once both live in the
 * same table.
 */

import { useDb } from '../../utils/db'
import type { Db } from '../../utils/db'
import { getDirectoryTool } from '../../utils/directory'
import { isHidden } from '../../utils/overrides'
import { getPublicBySlug, PAID_PLANS, publicTool } from '../../utils/submissions'
import { isoWeekId } from '~~/shared/utils/catalog'

/**
 * The address a retired slug moved to, or ''.
 *
 * A listing that was deleted and re-added before slugs became stable left its
 * old URL behind — and anything that already links to it (a Spotlight, a
 * sitemap copy, a bookmark) hits a 404 for a product that is still here. The
 * delete path records the slug and its domain; this walks that back to the
 * live listing.
 *
 * Only a listing the public can actually open counts, so a redirect never
 * lands on another 404.
 */
async function movedTo(db: Db, slug: string): Promise<string> {
  const alias = await db
    .prepare('SELECT domain FROM product_slug_alias WHERE slug = ?')
    .bind(slug)
    .first<{ domain: string }>()

  const domain = String(alias?.domain ?? '').trim()
  if (!domain) return ''

  const rows = await db
    .prepare(
      `SELECT slug, plan, paid_at FROM submissions
        WHERE domain = ? AND status = 'approved' AND slug <> ?`,
    )
    .bind(domain, slug)
    .all<{ slug: string; plan: string; paid_at: number | null }>()

  const live = rows.results.find(
    (row) => row.paid_at || !(PAID_PLANS as readonly string[]).includes(String(row.plan)),
  )
  return String(live?.slug ?? '')
}

export default defineEventHandler(async (event) => {
  const slug = String(getRouterParam(event, 'slug') ?? '').trim()
  if (!slug) {
    setResponseStatus(event, 400)
    return { ok: false, reason: 'bad_slug' }
  }

  const db = await useDb(event)

  // The operator's kill switch applies to both sources, and it is checked
  // before either is read so a pulled listing costs nothing to serve.
  if (await isHidden(db, slug)) {
    setResponseStatus(event, 410)
    return { ok: false, reason: 'removed' }
  }

  const hit = await getDirectoryTool(db, slug)

  if (hit) {
    const votes = await db
      .prepare('SELECT COUNT(*) AS n FROM votes WHERE week = ? AND slug = ?')
      .bind(isoWeekId(), slug)
      .first<{ n: number }>()

    // The catalogue's vote counts are a snapshot from build time; this week's
    // are in the table. Take the larger so a listing never appears to lose
    // votes it has already been given.
    const weekVotes = Number(votes?.n ?? 0)
    const tool = {
      ...hit.tool,
      votes_week: Math.max(hit.tool.votes_week, weekVotes),
    }

    setResponseHeader(event, 'cache-control', 'no-store')
    return { ok: true, tool, source: hit.source }
  }

  // Not in the overlay and not in the catalogue: a community submission may
  // still answer, under the same `publiclyListed` rule the admin queue uses.
  const row = await getPublicBySlug(db, slug)
  if (!row) {
    // A retired address for a listing that still exists answers 301, not 404.
    // The page turns `reason: 'moved'` into a permanent redirect, so whatever
    // already points here keeps working and the search engine moves its signal
    // to the live URL instead of dropping the page.
    const target = await movedTo(db, slug)
    if (target) {
      setResponseHeader(event, 'cache-control', 'no-store')
      return { ok: false, reason: 'moved', to: target }
    }
    setResponseStatus(event, 404)
    return { ok: false, reason: 'not_found' }
  }

  const votes = await db
    .prepare('SELECT COUNT(*) AS n FROM votes WHERE week = ? AND slug = ?')
    .bind(isoWeekId(), slug)
    .first<{ n: number }>()

  setResponseHeader(event, 'cache-control', 'no-store')
  return { ok: true, tool: publicTool(row, Number(votes?.n ?? 0)), source: 'submission' }
})
