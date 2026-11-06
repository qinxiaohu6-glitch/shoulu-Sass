/**
 * Source `shipany-dir/src/lib/time.ts` — the `formatDateTime` half.
 *
 * The source always receives an ISO string; this build stores integer Unix
 * seconds in most tables, so a number is treated as seconds. Anything
 * unparseable prints an em dash, which is what the source does too.
 *
 * One addition the source never needs: a bare `YYYY-MM-DD` prints as a date.
 * The catalogue's `created_at` and the ad window are day-precision columns, and
 * running them through a date-time formatter invents an `08:00:00` that was
 * never in the data.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function formatDateTime(input: string | number | Date | null | undefined): string {
  if (!input) return '—'
  if (typeof input === 'string' && DATE_ONLY.test(input)) {
    const day = new Date(`${input}T00:00:00Z`)
    if (Number.isNaN(day.getTime())) return '—'
    return day.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' })
  }
  const d =
    typeof input === 'number'
      ? new Date(input * 1000)
      : input instanceof Date
        ? input
        : new Date(input)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
