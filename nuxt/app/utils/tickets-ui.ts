/**
 * Source `routes/settings/-tickets-shared.tsx` — the parts that are not JSX.
 *
 * `PAGE_SIZE` and `STATUS_BADGE` are copied verbatim; `uploaderState` keeps its
 * contract (which URLs are usable, and whether anything is still in flight)
 * so the submit buttons disable on exactly the same condition as the source.
 */
import type { ImageUploaderValue } from '~/utils/image-upload'

export type TicketStatus = 'open' | 'replied' | 'closed'

/** What `/api/tickets` returns for one row, already snake_cased by the server. */
export interface TicketRow {
  id: string
  title: string
  status: TicketStatus
  created_at: number
  updated_at: number
  latest_reply: string | null
}

/** What `/api/tickets/[id]` returns for one message. */
export interface TicketMessageRow {
  id: string
  role: 'user' | 'admin'
  author: string
  content: string
  attachments: string[]
  created_at: number
}

export const PAGE_SIZE = 20

export const STATUS_BADGE: Record<TicketStatus, 'default' | 'secondary' | 'outline'> = {
  open: 'default',
  replied: 'secondary',
  closed: 'outline',
}

/** Extract uploaded URLs from uploader items; true while any upload is in flight. */
export function uploaderState(items: ImageUploaderValue[]) {
  return {
    urls: items.filter((i) => i.status === 'uploaded' && i.url).map((i) => i.url!),
    uploading: items.some((i) => i.status === 'uploading'),
  }
}
