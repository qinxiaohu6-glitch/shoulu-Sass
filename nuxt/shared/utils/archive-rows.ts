/**
 * Archived ranking rows, filtered to the listings that still exist.
 *
 * `week_archive` stores a slug, a vote count and a rank — and nothing else. The
 * archive is a historical record, so it keeps whatever slug was live that week,
 * even after the listing is deleted or re-slugged. Rendering it straight
 * produced the worst of both outcomes: the raw slug shown where a product name
 * belongs (`peachchat-private-1v1-vide…`) and a link to a 404.
 *
 * A row whose listing is gone cannot be repaired — the archive has no domain to
 * fall back on, unlike a Spotlight. So it is dropped, and the podium takes the
 * next listing that does exist.
 */

export type RankingRow = {
  slug: string
  votes?: number | string
  rank?: number
}

export type LiveRankingRow<T> = RankingRow & { tool: T }

export function liveRankingRows<T extends { slug: string }>(
  ranking: readonly RankingRow[] | undefined | null,
  listings: readonly T[],
): LiveRankingRow<T>[] {
  const bySlug = new Map(listings.map((entry) => [entry.slug, entry]))
  const out: LiveRankingRow<T>[] = []
  for (const row of ranking ?? []) {
    const slug = String(row?.slug ?? '')
    const tool = bySlug.get(slug)
    if (!tool) continue
    out.push({ ...row, slug, tool })
  }
  return out
}
