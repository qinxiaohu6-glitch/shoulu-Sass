/**
 * GET /api/directory/meta — the category, tag and collection lists.
 *
 * These three used to be build-time constants imported straight from
 * `catalog.json`, which was correct while the taxonomy was immutable. It is not
 * any more: an operator can rename a category or a tag in the console, and a
 * rename that only reaches the console would leave every card badge, pill row
 * and breadcrumb showing the old word. So the pages ask for the list instead.
 *
 * Database first, catalogue second — the same overlay rule the listings use.
 * A database with no taxonomy rows (the tables exist but were never seeded)
 * answers with the catalogue, so the site is unchanged until someone edits
 * something. Collections have no catalogue to fall back to: an empty table is
 * an empty index, because nothing in the seed implies a collection.
 *
 * The payload is deliberately flat and small (~3KB for the current directory):
 * it rides in the SSR payload of every page via `plugins/directory-meta.server.ts`,
 * so anything heavier would be paid for on every request.
 */

import { useDb } from '../../utils/db'
import { directoryMeta } from '../../utils/directory'

export default defineEventHandler(async (event) => {
  const db = await useDb(event)
  const meta = await directoryMeta(db)

  // No `no-store` here on purpose: the value changes only when an operator
  // saves, and the response is identical for every visitor. A short shared
  // cache helps a direct caller (a script, or the browser). It does *not* help
  // the SSR path — `plugins/directory-meta.server.ts` reaches this route with
  // `useRequestFetch`, which dispatches internally and never consults the edge
  // cache. The cost there is the queries themselves, which is why the handler
  // counts the listings once and shares the tally across all three lists.
  setResponseHeader(event, 'cache-control', 'public, max-age=0, s-maxage=30')

  return { ok: true, ...meta }
})
