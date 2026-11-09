/**
 * Homepage directory windows. Everything is Asia/Shanghai.
 *
 * A week runs Monday 00:00:00 inclusive through the next Monday 00:00:00
 * exclusive. A month is the calendar month on the same clock.
 * The publish countdown is only as real as `NEXT_PUBLISH_AT` or a row that
 * actually carries `scheduledLaunchAt` / `nextPublishAt`.
 */

import { NEXT_PUBLISH_AT } from '../content/publish.ts'

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export type TimeRange = { startMs: number; endMs: number }

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function shanghaiParts(date: Date): { year: number; month: number; day: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAY[parts.weekday ?? ''] ?? 0,
  }
}

export function shanghaiWeekRange(now = new Date()): TimeRange {
  const parts = shanghaiParts(now)
  const midnight = Date.parse(`${parts.year}-${pad(parts.month)}-${pad(parts.day)}T00:00:00+08:00`)
  const offset = parts.weekday === 0 ? 6 : parts.weekday - 1
  const startMs = midnight - offset * 86_400_000
  return { startMs, endMs: startMs + 7 * 86_400_000 }
}

export function shanghaiMonthRange(now = new Date()): TimeRange {
  const parts = shanghaiParts(now)
  const startMs = Date.parse(`${parts.year}-${pad(parts.month)}-01T00:00:00+08:00`)
  const nextMonth = parts.month === 12 ? 1 : parts.month + 1
  const nextYear = parts.month === 12 ? parts.year + 1 : parts.year
  const endMs = Date.parse(`${nextYear}-${pad(nextMonth)}-01T00:00:00+08:00`)
  return { startMs, endMs }
}

/** Catalogue dates are `YYYY-MM-DD` directory days. Instants may be ISO or unix. */
export function parseInstant(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value
  }
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const ms = Date.parse(`${raw}T00:00:00+08:00`)
    return Number.isFinite(ms) ? ms : null
  }
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

export function inWindow(ms: number | null, range: TimeRange): boolean {
  return ms != null && ms >= range.startMs && ms < range.endMs
}

export function filterByWindow<T>(rows: readonly T[], range: TimeRange, at: (row: T) => unknown): T[] {
  return rows.filter((row) => inWindow(parseInstant(at(row)), range))
}

/**
 * Earliest future publish instant, or null. There is no synthetic 24h window.
 */
export function nextLaunchInstant(rows: readonly object[], now = Date.now()): number | null {
  const times: number[] = []
  const configured = parseInstant(NEXT_PUBLISH_AT)
  if (configured != null) times.push(configured)
  for (const row of rows) {
    const rec = row as Record<string, unknown>
    for (const key of ['scheduledLaunchAt', 'nextPublishAt'] as const) {
      const ms = parseInstant(rec[key])
      if (ms != null) times.push(ms)
    }
  }
  const future = times.filter((ms) => ms > now)
  if (!future.length) return null
  return Math.min(...future)
}

export function remainingHms(targetMs: number, now = Date.now()): { h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor((targetMs - now) / 1000))
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  }
}

export function remainingDhms(targetMs: number, now = Date.now()): { d: number; h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor((targetMs - now) / 1000))
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  }
}

export function remainingDayHour(targetMs: number, now = Date.now()): { d: number; h: number } {
  const totalHours = Math.max(0, Math.floor((targetMs - now) / 3_600_000))
  return { d: Math.floor(totalHours / 24), h: totalHours % 24 }
}
