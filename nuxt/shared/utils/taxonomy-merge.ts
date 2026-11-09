/**
 * Console taxonomy = rows already stored, with the catalogue seeds filled in.
 *
 * A seed the database has never copied still has to show up, because that is
 * what the public pages fall back to when the tables are empty. A stored row
 * wins over its seed so an edit is not painted back by the catalogue. A
 * tombstoned slug stays gone. Nothing here removes a seed from `catalog.json`.
 */
export function mergeBySlug<T extends { slug: string }>(
  stored: T[],
  seeds: T[],
  tombstoned: Iterable<string> = [],
): T[] {
  const dead = new Set(tombstoned)
  const storedBySlug = new Map<string, T>()
  for (const row of stored) {
    if (!dead.has(row.slug)) storedBySlug.set(row.slug, row)
  }

  const seen = new Set<string>()
  const out: T[] = []
  for (const seed of seeds) {
    if (dead.has(seed.slug) || seen.has(seed.slug)) continue
    out.push(storedBySlug.get(seed.slug) ?? seed)
    seen.add(seed.slug)
  }
  for (const row of stored) {
    if (dead.has(row.slug) || seen.has(row.slug)) continue
    out.push(row)
    seen.add(row.slug)
  }
  return out
}
