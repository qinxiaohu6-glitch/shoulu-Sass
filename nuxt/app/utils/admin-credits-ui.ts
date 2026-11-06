/**
 * Source `routes/admin/credits.tsx` — the row shape and the page's constants.
 *
 * This is the source's `Credit`, which is the user-detail credit row plus the
 * account it belongs to (`-user-credits.tsx` reads those from the endpoint's
 * join). The ledger itself is empty in this build — see
 * `server/api/admin/credits/index.get.ts`.
 */

export interface AdminCreditListRow {
  id: string
  userId: string
  userEmail: string | null
  userName: string | null
  userImage: string | null
  transactionNo: string
  transactionType: string
  transactionScene: string | null
  credits: number
  remainingCredits: number
  description: string | null
  expiresAt: string | null
  status: string
  createdAt: string
}

/** The page's own page size — the user-detail card uses 10, this list 20. */
export const ADMIN_CREDITS_PAGE_SIZE = 20

export const CREDITS_TABS = ['all', 'grant', 'consume'] as const
export type CreditsTab = (typeof CREDITS_TABS)[number]

/** Grant reads green, consume red; the source hard-codes both. */
export function creditAmountClass(credits: number) {
  return credits > 0 ? 'text-green-600' : 'text-red-500'
}
