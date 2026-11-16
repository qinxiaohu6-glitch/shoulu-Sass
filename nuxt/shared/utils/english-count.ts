/**
 * English count words. Chinese does not use this: callers keep their own
 * measure words. `1` takes the singular; every other count, including 0,
 * takes the plural.
 */
export function englishCount(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural
}
