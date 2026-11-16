/**
 * Maker profiles moved from `/makers` to `/community/makers`.
 * A 301, including the Chinese prefix. Query strings stay on the new URL.
 * `.html` is handled here too, so a legacy hop cannot stop one step short.
 */

import { makerLegacyRedirect } from '~~/shared/utils/community'

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const target = makerLegacyRedirect(url.pathname)
  if (!target || target === url.pathname) return
  return sendRedirect(event, `${target}${url.search}`, 301)
})
