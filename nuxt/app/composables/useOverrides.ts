import type { OverrideView } from '~~/shared/utils/catalog'

/**
 * The operator's pin / hide switches, as the whole app sees them.
 *
 * The value is loaded once per render by `plugins/overrides.server.ts` and then
 * rides along in the payload, so reading it here is synchronous and costs no
 * request. Every listing helper in `shared/utils/catalog.ts` accepts this object
 * as an optional last argument; passing it is what makes the admin panel's two
 * switches actually change the site.
 */
export function useOverrides(): Ref<OverrideView> {
  return useState<OverrideView>('overrides', () => ({ pinned: {}, hidden: [] }))
}
