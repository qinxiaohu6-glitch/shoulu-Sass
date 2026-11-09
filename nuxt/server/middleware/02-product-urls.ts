/**
 * Product detail pages moved from `/tools/:slug` to `/products/:slug`.
 * `/tools` itself is the utility hub, and `/tools/dr-checker` is the DR page,
 * so those two are not redirected.
 */

import { productRedirect } from '~~/shared/utils/product-routes'

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const target = productRedirect(url.pathname)
  if (!target || target === url.pathname) return
  return sendRedirect(event, `${target}${url.search}`, 301)
})
