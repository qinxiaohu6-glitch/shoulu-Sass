/**
 * The placement each slot is showing right now.
 *
 * Booked ads are a database read, so pages `await` this and the server renders
 * the ad into the HTML — an ad that appeared only after hydration would be a
 * layout shift on the busiest page of the site, and invisible to a crawler.
 *
 * `null` means "nothing booked", which is a normal state: the slot renders no
 * frame at all rather than an empty box the live site does not have.
 */
export type AdPublic = {
  id: string
  slot: string
  name: string
  headline: string
  url: string
  logo: string
  start: string
  end: string
  note: string
}

type AdsPayload = { board: AdPublic | null; sidebar: AdPublic | null }

const EMPTY: AdsPayload = { board: null, sidebar: null }

/**
 * The public availability hint, used by the homepage, /pricing and /book-ad to
 * show open weeks before anybody has typed an email. It is a hint, not a lock:
 * the checkout and the webhook repeat the conflict check when money arrives.
 *
 * Kept here next to `useAds()` because both describe the same two slots, and a
 * page that shows a price should never disagree with the page that sells it.
 */
export type AdAvailability = {
  ok: boolean
  starts: string[]
  available: Record<string, boolean>
}

export const EMPTY_AD_AVAILABILITY: AdAvailability = {
  ok: false,
  starts: [],
  available: {},
}

/** Mondays still open, in the order the API returns them. Empty on any failure. */
export function openAdWeeks(data: AdAvailability | null | undefined): string[] {
  if (!data?.ok) return []
  return data.starts.filter((day) => data.available[day] !== false)
}

export async function useAds(): Promise<{
  board: ComputedRef<AdPublic | null>
  sidebar: ComputedRef<AdPublic | null>
}> {
  // Relative `$fetch` cannot resolve on Workers — see `overrides.server.ts`.
  // The `catch` here would otherwise make every booked placement look unbooked.
  const requestFetch = useRequestFetch()

  const { data } = await useAsyncData<AdsPayload>(
    'active-ads',
    async () => {
      try {
        const res = await requestFetch<Partial<AdsPayload>>('/api/ads')
        return { board: res?.board ?? null, sidebar: res?.sidebar ?? null }
      } catch {
        // A missing ad is a missing ad; a failed ad fetch must not blank the page.
        return EMPTY
      }
    },
    { default: () => EMPTY },
  )

  return {
    board: computed(() => data.value?.board ?? null),
    sidebar: computed(() => data.value?.sidebar ?? null),
  }
}
