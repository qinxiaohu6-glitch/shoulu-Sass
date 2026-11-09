/**
 * The review queue pages on the client. A tab change used to leave `page`
 * past the end of the shorter list, so the body was empty while the footer
 * still printed the unpaged total.
 */
export function pageWindow(
  length: number,
  page: number,
  pageSize: number,
): { page: number; start: number; end: number } {
  const size = Math.max(1, Math.trunc(pageSize) || 1)
  const count = Math.max(0, Math.trunc(length) || 0)
  const pages = Math.max(1, Math.ceil(count / size))
  const requested = Math.trunc(Number(page))
  const current = Math.min(pages, Math.max(1, Number.isFinite(requested) && requested > 0 ? requested : 1))
  const start = (current - 1) * size
  return { page: current, start, end: Math.min(count, start + size) }
}

/** The tab is a status. `all` is the only value that does not filter. */
export function filterByStatus<T extends { status: string }>(rows: T[], tab: string): T[] {
  if (!tab || tab === 'all') return rows
  return rows.filter((row) => row.status === tab)
}
