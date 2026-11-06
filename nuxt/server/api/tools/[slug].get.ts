/**
 * GET /api/tools/:slug — one *submitted* listing, ready to render.
 *
 * The curated catalogue is not served from here. Those thirty pages come from
 * a static import, so a round trip would only add latency to a page that is
 * already fully known at build time. This route answers the one question the
 * import cannot: "has somebody submitted this, and is it live?".
 *
 * "Live" is the same `publiclyListed` predicate the admin queue uses, so a
 * pending record, a rejected one and a paid-but-unpaid one are indistinguishable
 * from a slug that never existed — a 404 here, not a 403.
 */

import { useDb } from '../../utils/db'
import { isHidden } from '../../utils/overrides'
import { getPublicBySlug, publicTool } from '../../utils/submissions'
import { isoWeekId } from '~~/shared/utils/catalog'

export default defineEventHandler(async (event) => {
  const slug = String(getRouterParam(event, 'slug') ?? '').trim()

  const db = await useDb(event)
  const row = await getPublicBySlug(db, slug)
  if (!row) {
    setResponseStatus(event, 404)
    return { ok: false, reason: 'not_found' }
  }

  // The operator can pull a listing that is otherwise live. The page answers
  // 410, so this does too — and it is checked after `publiclyListed`, so a
  // pending record still cannot be probed for.
  if (await isHidden(db, slug)) {
    setResponseStatus(event, 410)
    return { ok: false, reason: 'removed' }
  }

  // A submitted listing is voteable exactly like a curated one — the `votes`
  // table keys on slug, not on the catalogue — so the number on the button has
  // to come from the same place the click writes to.
  const votes = await db
    .prepare('SELECT COUNT(*) AS n FROM votes WHERE week = ? AND slug = ?')
    .bind(isoWeekId(), slug)
    .first<{ n: number }>()

  // The review queue can flip a listing at any moment, and a cached "live"
  // answer would keep a pulled listing on screen.
  setResponseHeader(event, 'cache-control', 'no-store')
  return { ok: true, tool: publicTool(row, Number(votes?.n ?? 0)) }
})
