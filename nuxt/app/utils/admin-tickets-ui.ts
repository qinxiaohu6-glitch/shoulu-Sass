/**
 * Source `routes/admin/-tickets-shared.tsx` — the shapes and constants the
 * admin queue uses. The reporter's side keeps `utils/tickets-ui.ts`, which is
 * the snake_case wire from `/api/tickets`; this one is the source's camelCase
 * console shape, answered by `/api/admin/tickets`.
 */

export type TicketStatus = 'open' | 'replied' | 'closed'
export type AdminTicketTab = 'all' | TicketStatus

export const ADMIN_TICKET_TABS: AdminTicketTab[] = ['all', 'open', 'replied', 'closed']

export const ADMIN_TICKETS_PAGE_SIZE = 20

export interface AdminTicketRow {
  id: string
  title: string
  status: TicketStatus
  createdAt: string
  updatedAt: string
  userId: string
  userName: string | null
  userEmail: string | null
  userAvatar: string | null
  latestReply: string | null
}

export interface AdminTicketMessageRow {
  id: string
  role: 'user' | 'admin'
  content: string
  attachments: string[]
  createdAt: string
  userName: string | null
  userAvatar: string | null
}

export const TICKET_STATUS_BADGE: Record<TicketStatus, 'default' | 'secondary' | 'outline'> = {
  open: 'default',
  replied: 'secondary',
  closed: 'outline',
}

export function ticketStatusVariant(status: string) {
  return TICKET_STATUS_BADGE[status as TicketStatus] ?? 'outline'
}
