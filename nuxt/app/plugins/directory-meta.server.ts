import type { Category, Collection, Tag } from '~~/shared/types/catalog'
import { FALLBACK_META } from '../composables/useDirectoryMeta'

/**
 * Load the taxonomy before the first byte is rendered.
 *
 * This has to be server-side and it has to block, for the same reason the
 * overrides plugin does: a category badge that only appeared after hydration
 * would be missing from the HTML a crawler reads, and a pill row that arrived
 * late would reflow the page in front of the reader. Async plugins are awaited
 * before `renderToString`, so the lists are in place when the page composes.
 *
 * The result lands in `useState`, which serialises it into the payload;
 * hydration picks it up with no second request. That is also why the endpoint
 * stays deliberately small — this ships on every page.
 */
export default defineNuxtPlugin(async () => {
  const state = useState('directory-meta', () => FALLBACK_META)

  /**
   * Bound to the incoming request, not the global `$fetch`: the global one
   * cannot resolve a relative path on Cloudflare Workers, and the `catch` below
   * would turn that into a silently empty taxonomy — every page would fall back
   * to the build-time catalogue and an operator's rename would appear to do
   * nothing.
   */
  const requestFetch = useRequestFetch()

  try {
    const res = await requestFetch<{
      categories?: Category[]
      tags?: Tag[]
      collections?: Collection[]
    }>('/api/directory/meta')

    state.value = {
      // An empty array is a real answer for collections (no editorial act yet)
      // but not for categories or tags, where it means the read failed — the
      // catalogue is the honest fallback in that case.
      categories: Array.isArray(res?.categories) && res.categories.length
        ? res.categories
        : FALLBACK_META.categories,
      tags: Array.isArray(res?.tags) && res.tags.length ? res.tags : FALLBACK_META.tags,
      collections: Array.isArray(res?.collections) ? res.collections : [],
    }
  } catch {
    // Keeping the catalogue is the safe direction: the site renders exactly as
    // it did before the tables existed, and the only loss is an operator's
    // rename not being reflected until the next request succeeds.
    state.value = FALLBACK_META
  }
})
