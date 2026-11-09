/**
 * The Billboard ranking used by the homepage and /billboard.
 * Both pages call this composable so they cannot grow a second list.
 */

import { BILLBOARD_TOP_N } from '~~/shared/content/billboard'
import { padBillboard, type BillboardRow } from '~~/shared/utils/billboard'

export async function useBillboard() {
  const requestFetch = useRequestFetch()
  const { data } = await useAsyncData(
    'billboard-ranking',
    async () => {
      try {
        return await requestFetch<{ ok: boolean; placements: BillboardRow[] }>('/api/billboard')
      } catch {
        return { ok: false, placements: [] as BillboardRow[] }
      }
    },
    { default: () => ({ ok: false, placements: [] as BillboardRow[] }) },
  )

  const ranked = computed(() => data.value?.placements ?? [])
  const homeGrid = computed(() => padBillboard(ranked.value, BILLBOARD_TOP_N))

  return { ranked, homeGrid }
}
