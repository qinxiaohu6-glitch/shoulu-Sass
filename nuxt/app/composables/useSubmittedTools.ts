import type { ComputedRef } from 'vue'
import type { LocalizedTool, Tool } from '~~/shared/types/catalog'

/**
 * Live submissions, shaped like catalogue tools.
 *
 * Fetched once per navigation and shared through the payload, so the homepage,
 * the listing and a category page never pay for the same query twice. Callers
 * `await` it so the server renders the full list — a listing that fills in
 * after hydration would shift the page and hide the newest entry from a
 * crawler.
 *
 * `server: false` + `immediate: false` is the "only when someone asks" mode:
 * the search dialog uses it so the header costs nothing until it is opened.
 */
export async function useSubmittedTools(
  opts: { key?: string; server?: boolean; immediate?: boolean } = {},
): Promise<ComputedRef<LocalizedTool[]>> {
  const { lang } = useLang()

  // Relative `$fetch` cannot resolve on Workers — see `overrides.server.ts`.
  // Without this the directory would quietly render as catalogue-only on the
  // live site while looking complete locally.
  const requestFetch = useRequestFetch()

  const { data } = await useAsyncData<Tool[]>(
    opts.key ?? 'submitted-tools',
    async () => {
      try {
        const res = await requestFetch<{ ok: boolean; tools?: Tool[] }>('/api/tools')
        return res?.tools ?? []
      } catch {
        // The curated catalogue is still a complete directory; losing the
        // newest listings is a smaller failure than an error page.
        return []
      }
    },
    {
      default: () => [],
      server: opts.server ?? true,
      immediate: opts.immediate ?? true,
    },
  )

  return computed(() => (data.value ?? []).map((tool) => localizeTool(tool, lang.value)))
}
