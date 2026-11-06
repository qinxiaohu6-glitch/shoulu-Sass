/**
 * GET /api/tools — every live *submitted* listing, as catalogue `Tool`s.
 *
 * The curated thirty are a static import and are not repeated here; the
 * listing pages already have them and a round trip would only add latency.
 * This answers the part the import cannot: what has the community published?
 *
 * A database outage must not take the directory down, so it degrades to an
 * empty list with a 503 — the pages then render exactly the curated catalogue,
 * which is still a correct page, just without the newest listings.
 */

import { useDb } from '../../utils/db'
import { loadOverrides } from '../../utils/overrides'
import { listPublishedTools } from '../../utils/submissions'

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb(event)
    const [tools, overrides] = await Promise.all([listPublishedTools(db), loadOverrides(db)])
    // A pulled listing is still a row — it is the page that is gone. Dropping it
    // here keeps it out of every merged list without each page re-filtering.
    const hidden = new Set(overrides.hidden)
    // A listing can be approved at any moment, so a cached copy is only ever
    // stale. The payload is small and the pages are server-rendered.
    setResponseHeader(event, 'cache-control', 'no-store')
    return { ok: true, tools: tools.filter((tool) => !hidden.has(tool.slug)) }
  } catch (err) {
    console.error('[tools] submissions unavailable', err)
    setResponseStatus(event, 503)
    return { ok: false, tools: [] }
  }
})
