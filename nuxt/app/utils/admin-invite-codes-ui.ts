/**
 * Source `routes/admin/-invite-codes-shared.tsx` — the page's vocabulary.
 *
 * The zod schema is replaced by `isInviteFormValid`: Vue has no form library in
 * this port (every other ported dialog validates the same way — one function on
 * submit), and the rule is the schema's, field for field.
 */

export const INVITE_TABS = ['all', 'available', 'used'] as const
export type InviteTab = (typeof INVITE_TABS)[number]

export interface InviteCodeRow {
  id: string
  code: string
  maxUses: number
  usedCount: number
  trialDays: number
  note: string | null
  expiresAt: string | null
  createdAt: string
}

export const INVITE_PAGE_SIZE = 20

export interface InviteCodeForm {
  count: string
  maxUses: string
  trialDays: string
  note: string
  expiresAt: string
}

export function emptyInviteForm(): InviteCodeForm {
  return { count: '1', maxUses: '1', trialDays: '15', note: '', expiresAt: '' }
}

/** `z.coerce.number().min(1)` on the three numeric fields. */
export function isInviteFormValid(form: InviteCodeForm): boolean {
  return (['count', 'maxUses', 'trialDays'] as const).every((key) => {
    const value = Number(form[key])
    return Number.isFinite(value) && value >= 1
  })
}

/** The source's submit body: `count` only when more than one is asked for. */
export function toInvitePayload(form: InviteCodeForm) {
  const count = Number(form.count)
  return {
    count: count > 1 ? count : undefined,
    maxUses: Number(form.maxUses),
    trialDays: Number(form.trialDays),
    note: form.note || undefined,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
  }
}
