/**
 * GET /api/overrides — the operator's pin/hide switches, as the pages need them.
 *
 * Public: the list is just "which slugs are pinned, which are gone". Hiding a
 * listing is not a secret — the page answers 410, which says so out loud.
 *
 * Failure returns an empty state rather than an error: without it the pages
 * render the catalogue exactly as built, which is the safe direction (a pin
 * that fails to load shows nothing extra; a hide that fails to load shows the
 * page rather than 410ing it).
 */

import { useDb } from '../utils/db'
import { EMPTY_OVERRIDES, loadOverrides } from '../utils/overrides'

export default defineEventHandler(async (event) => {
  try {
    const db = await useDb(event)
    setResponseHeader(event, 'cache-control', 'no-store')
    return { ok: true, ...(await loadOverrides(db)) }
  } catch (err) {
    console.error('[overrides]', err)
    return { ok: false, ...EMPTY_OVERRIDES }
  }
})
