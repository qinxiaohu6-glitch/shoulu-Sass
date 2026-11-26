import { useDb } from '../../utils/db'
import { loadOverrides } from '../../utils/overrides'
import { listPublishedTools } from '../../utils/submissions'

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb(event)
    const [apps, overrides] = await Promise.all([
      listPublishedTools(db, 500, 'app'),
      loadOverrides(db),
    ])
    const hidden = new Set(overrides.hidden)
    setResponseHeader(event, 'cache-control', 'no-store')
    return { ok: true, apps: apps.filter((app) => !hidden.has(app.slug)) }
  } catch (error) {
    console.error('[apps] submissions unavailable', error)
    setResponseStatus(event, 503)
    return { ok: false, apps: [] }
  }
})
