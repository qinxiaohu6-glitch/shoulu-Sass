/**
 * Who is signed in — one lookup per page load, shared by everyone who asks.
 *
 * `/api/me` answers `{ user: null }` for a signed-out visitor rather than 401,
 * so "not loaded yet" and "signed out" collapse into the same value. That is
 * deliberate: it lets the hero decide on the first click without a second
 * round trip, and it keeps the server-rendered markup identical for both.
 */

export type SessionUser = {
  email: string
  name: string
  picture: string
}

type SessionState = { user: SessionUser | null; loaded: boolean }

export function useSession() {
  const state = useState<SessionState>('session', () => ({ user: null, loaded: false }))
  // Resolved during setup so it can be called later from an event handler:
  // on the server this is the variant that forwards the incoming cookie, and
  // without it every SSR lookup would come back "signed out".
  const requestFetch = useRequestFetch()

  async function refresh(): Promise<SessionUser | null> {
    try {
      const res = await requestFetch<{ user?: SessionUser | null }>('/api/me')
      state.value = { user: res?.user ?? null, loaded: true }
    } catch {
      // A failed lookup is treated as signed out. Retrying on every click
      // would be worse than showing the sign-in CTA to someone who is in fact
      // signed in but briefly offline.
      state.value = { user: null, loaded: true }
    }
    return state.value.user
  }

  /** Resolve once, then answer from cache. */
  async function ensure(): Promise<SessionUser | null> {
    return state.value.loaded ? state.value.user : refresh()
  }

  function clear() {
    state.value = { user: null, loaded: true }
  }

  /**
   * Signing out is a plain navigation, not a fetch: the endpoint answers with a
   * 302 and an expired cookie, and doing it client-side would leave the browser
   * holding a cookie the server already considers dead.
   */
  function signOut(next = '/') {
    clear()
    window.location.href = `/auth/logout?next=${encodeURIComponent(next)}`
  }

  return {
    user: computed(() => state.value.user),
    signedIn: computed(() => Boolean(state.value.user)),
    loaded: computed(() => state.value.loaded),
    refresh,
    ensure,
    clear,
    signOut,
  }
}
