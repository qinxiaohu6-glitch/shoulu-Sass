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
import { getDirectoryTool } from '../../utils/directory'
import { isHidden } from '../../utils/overrides'
import { getPublicBySlug, publicTool } from '../../utils/submissions'
import { isoWeekId } from '~~/shared/utils/catalog'

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
