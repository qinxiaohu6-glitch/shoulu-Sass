/**
 * Source `hooks/use-user-features.ts` + `config/user-features.ts`.
 *
 * The source asks `/api/user/features` and an admin switch flips each one on or
 * off. This build has no admin config table, so the source's *defaults* are the
 * only state — which is also what the source renders on a fresh install:
 * credits, billing, payments and tickets on; API keys off until the project
 * actually sells API access.
 *
 * `loaded` is always `true` for the same reason: there is nothing to wait for.
 * Keeping the field means the gate reads exactly like the source's.
 */
export type UserFeatureKey = 'credits' | 'billing' | 'payments' | 'apikeys' | 'tickets'

const FEATURES: Record<UserFeatureKey, boolean> = {
  credits: true,
  billing: true,
  payments: true,
  apikeys: false,
  tickets: true,
}

export function useUserFeatures() {
  return { loaded: true as const, ...FEATURES }
}
