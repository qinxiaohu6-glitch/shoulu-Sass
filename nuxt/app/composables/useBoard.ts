import type { Ref } from 'vue'
import type { Week } from '~~/shared/types/catalog'
import { weekFromQuery } from '~~/shared/utils/weekly-board'

/**
 * The live weekly board.
 *
 * `week` is the requested ISO week (or the current one). `current` is always
 * the open UTC week, ranked from the same votes as `/api/votes`. `history`
 * is closed weeks in archive order, newest first. An archived week is not
 * recomputed here.
 */
export type BoardPayload = {
  ok: boolean
  week: Week | null
  source?: 'live' | 'archive' | 'backfill' | 'future'
  current: Week | null
  history: Week[]
  archived: string[]
}

const EMPTY: BoardPayload = { ok: false, week: null, current: null, history: [], archived: [] }

export async function useBoardData(): Promise<Ref<BoardPayload>> {
  const route = useRoute()
  const requestFetch = useRequestFetch()
  const requested = computed(() => weekFromQuery(route.query as Record<string, unknown>))

  const { data } = await useAsyncData<BoardPayload>(
    'live-board',
    async () => {
      try {
        const query = requested.value ? `?week=${encodeURIComponent(requested.value)}` : ''
        const res = await requestFetch<BoardPayload>(`/api/board${query}`)
        return res ?? EMPTY
      } catch {
        return EMPTY
      }
    },
    { default: () => EMPTY, watch: [requested] },
  )

  return computed(() => data.value ?? EMPTY)
}
