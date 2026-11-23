/**
 * Where the sponsored row sits inside a week's feed.
 *
 * The board slot is sold as "one sponsored banner on the launch board, under
 * the top 3" (see `adPlans` in `shared/content/pricing.ts`). That sentence is
 * the contract, so the position is a rule and not a layout accident: after the
 * third row, never before it, never at the bottom.
 *
 * A week with fewer than three launches still shows the slot — dropping it
 * would mean the placement silently stops existing during a quiet week, which
 * is exactly when a buyer would notice. It goes after the last row instead.
 *
 * Returns 0 when there is no feed at all (an empty week has no rows to sit
 * between, and the page renders its empty state instead).
 */
export function adAfterRank(rowCount: number): number {
  if (!Number.isFinite(rowCount) || rowCount < 1) return 0
  return Math.min(3, Math.floor(rowCount))
}
