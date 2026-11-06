import type { Week } from '~~/shared/types/catalog'

/**
 * The newest week closed by the Monday cron, or `null` while the archive is
 * empty.
 *
 * Pages compare its id against the newest week in the build-time catalogue and
 * only prefer it when it is genuinely newer — that is what keeps a fresh
 * install, and every page before the first cron run, rendering exactly the
 * catalogue it shipped with.
 */
export async function useBoard(): Promise<ComputedRef<Week | null>> {
  // See the note in `overrides.server.ts`: a relative `$fetch` has no origin on
  // Workers, and this composable's `catch` would turn that into a silent
  // "no archive yet" forever.
  const requestFetch = useRequestFetch()

  const { data } = await useAsyncData<Week | null>(
    'board-week',
    async () => {
      try {
        const res = await requestFetch<{ ok: boolean; week?: Week | null }>('/api/board')
        return res?.week ?? null
      } catch {
        return null
      }
    },
    { default: () => null },
  )

  return computed(() => data.value ?? null)
}
