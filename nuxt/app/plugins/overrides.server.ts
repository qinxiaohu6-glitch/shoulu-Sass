import type { OverrideView } from '~~/shared/utils/catalog'

/**
 * Fetch the operator overrides before the first byte is rendered.
 *
 * This has to be server-side and it has to block: a hidden listing that only
 * disappeared after hydration would still be in the HTML a crawler reads, and a
 * pin that arrived late would shuffle the featured block in front of the reader.
 * The async plugin is awaited before `renderToString`, so both are already in
 * place when the page is composed.
 *
 * The result lands in `useState`, which means it is serialised into the payload
 * and hydration picks it up without a second request.
 */
export default defineNuxtPlugin(async () => {
  const state = useState<OverrideView>('overrides', () => ({ pinned: {}, hidden: [], sort: {} }))

  /**
   * Bound to the incoming request, not the global `$fetch`.
   *
   * The global one cannot resolve a relative path on Cloudflare Workers — there
   * is no ambient origin the way there is under Node — so it throws a network
   * error that the `catch` below would swallow. The overrides would then be
   * silently empty on every request: pins and hides would work in the admin
   * panel and have no effect on the live site, with nothing in the logs.
   */
  const requestFetch = useRequestFetch()

  try {
    const res = await requestFetch<Partial<OverrideView>>('/api/overrides')
    const sort = res?.sort
    state.value = {
      pinned: res?.pinned && typeof res.pinned === 'object' ? res.pinned : {},
      hidden: Array.isArray(res?.hidden) ? res.hidden : [],
      sort: sort && typeof sort === 'object' && !Array.isArray(sort) ? sort : {},
    }
  } catch {
    // Empty is the safe direction on both switches: a lost pin just means a
    // listing is not promoted, a lost hide means a page stays reachable. Neither
    // is worth failing a render over.
    state.value = { pinned: {}, hidden: [], sort: {} }
  }
})
