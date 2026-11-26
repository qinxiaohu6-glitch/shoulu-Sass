import { useDb } from '../../utils/db'
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
  if (await isHidden(db, slug)) {
    setResponseStatus(event, 410)
    return { ok: false, reason: 'removed' }
  }

  const row = await getPublicBySlug(db, slug, 'app')
  if (!row) {
    setResponseStatus(event, 404)
    return { ok: false, reason: 'not_found' }
  }

  const votes = await db
    .prepare('SELECT COUNT(*) AS n FROM votes WHERE week = ? AND slug = ?')
    .bind(isoWeekId(), slug)
    .first<{ n: number }>()
  setResponseHeader(event, 'cache-control', 'no-store')
  return { ok: true, app: publicTool(row, Number(votes?.n ?? 0)) }
})
