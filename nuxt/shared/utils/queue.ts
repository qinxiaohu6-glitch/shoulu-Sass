/**
 * Queue figures a page is allowed to print.
 *
 * Every field is counted from submission rows. `median_review_days` is null
 * when there is nothing to measure, so a page hides the number instead of
 * printing 0. `paid_publish` is the constant the webhook actually does.
 */

export type ReviewSpan = { createdAt: number; reviewedAt: number }

export type QueueStats = {
  free_pending: number
  reviewed_last_30d: number
  median_review_days: number | null
  paid_publish: 'immediate'
}

export function medianReviewDays(samples: readonly ReviewSpan[]): number | null {
  const days = samples
    .map((sample) => (sample.reviewedAt - sample.createdAt) / 86400)
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b)
  if (!days.length) return null
  const mid = Math.floor(days.length / 2)
  const value = days.length % 2 === 1 ? days[mid]! : (days[mid - 1]! + days[mid]!) / 2
  return Math.round(value * 10) / 10
}

export function queueStats(input: {
  freePending: number
  reviewedLast30d: number
  samples: readonly ReviewSpan[]
}): QueueStats {
  return {
    free_pending: Math.max(0, Math.trunc(input.freePending)),
    reviewed_last_30d: Math.max(0, Math.trunc(input.reviewedLast30d)),
    median_review_days: medianReviewDays(input.samples),
    paid_publish: 'immediate',
  }
}
