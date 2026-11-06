/**
 * GET /api/guest-posts/info — the public guest-post rules and packages.
 *
 * Source `server/api/guest-posts/info.ts` reads configured packages. This build
 * sells none: listings are bought one-off through `payment_order` and there is
 * no submission flow, so the feature reports itself as off rather than showing
 * an empty package list that would still imply the offer exists.
 */

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  return { enabled: false, minWords: 0, packages: [] }
})
