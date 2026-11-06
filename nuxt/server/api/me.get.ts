/**
 * GET /api/me — who is signed in, if anyone.
 *
 * The layout calls this client-side only (`server: false`), so a signed-out
 * visitor still gets the same first paint as the static site; this just fills
 * the topbar in after hydration.
 *
 * Only the public profile goes out. `sub` stays server-side: it is the key
 * `submissions.owner_sub` is written with, and the page has no use for a
 * stable identifier it would then have to be careful with.
 */

import { readSession } from '../utils/session'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const me = await readSession(event)
  if (!me) return { ok: true, user: null }
  return {
    ok: true,
    user: { email: me.email, name: me.name ?? '', picture: me.picture ?? '' },
  }
})
