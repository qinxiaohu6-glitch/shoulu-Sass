import type { ComputedRef } from 'vue'
import type { LocalizedTool, Tool } from '~~/shared/types/catalog'

export async function useSubmittedApps(
  opts: { key?: string; server?: boolean } = {},
): Promise<ComputedRef<LocalizedTool[]>> {
  const { lang } = useLang()
  const requestFetch = useRequestFetch()
  const { data } = await useAsyncData<Tool[]>(
    opts.key ?? 'submitted-apps',
    async () => {
      try {
        const response = await requestFetch<{ ok: boolean; apps?: Tool[] }>('/api/apps')
        return response?.apps ?? []
      } catch {
        return []
      }
    },
    { default: () => [], server: opts.server ?? true },
  )
  return computed(() => (data.value ?? []).map((app) => localizeTool(app, lang.value)))
}
