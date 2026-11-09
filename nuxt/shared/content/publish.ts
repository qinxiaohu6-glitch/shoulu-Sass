/**
 * The next directory publish, if one is actually scheduled.
 *
 * Leave this null when nothing is on the calendar. The homepage countdown
 * reads it (and any future `scheduledLaunchAt` / `nextPublishAt` on a row)
 * and otherwise shows an empty state. Do not put a placeholder timestamp here.
 */
export const NEXT_PUBLISH_AT: string | null = null
