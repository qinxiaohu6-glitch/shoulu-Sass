import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  filterByWindow,
  nextLaunchInstant,
  parseInstant,
  shanghaiMonthRange,
  shanghaiWeekRange,
} from './directory-window.ts'

test('Shanghai weeks start Monday and months are calendar months', () => {
  const monday = new Date('2026-11-09T10:00:00+08:00')
  const week = shanghaiWeekRange(monday)
  assert.equal(week.startMs, Date.parse('2026-11-09T00:00:00+08:00'))
  assert.equal(week.endMs, Date.parse('2026-11-16T00:00:00+08:00'))
  assert.equal(shanghaiWeekRange(new Date('2026-11-15T23:30:00+08:00')).startMs, week.startMs)
  assert.equal(shanghaiWeekRange(new Date('2026-11-16T00:00:00+08:00')).startMs, Date.parse('2026-11-16T00:00:00+08:00'))

  const month = shanghaiMonthRange(monday)
  assert.equal(month.startMs, Date.parse('2026-11-01T00:00:00+08:00'))
  assert.equal(month.endMs, Date.parse('2026-12-01T00:00:00+08:00'))

  const rows = [{ created_at: '2026-11-09' }, { created_at: '2026-11-08' }, { created_at: '2026-10-31' }]
  assert.deepEqual(
    filterByWindow(rows, week, (row) => row.created_at).map((row) => row.created_at),
    ['2026-11-09'],
  )
  assert.equal(parseInstant('2026-11-09'), Date.parse('2026-11-09T00:00:00+08:00'))
})

test('the publish countdown stays empty unless a real instant is in the future', () => {
  const now = Date.parse('2026-11-09T10:00:00+08:00')
  assert.equal(nextLaunchInstant([], now), null)
  assert.equal(nextLaunchInstant([{ created_at: '2026-11-10' }], now), null)
  const at = Date.parse('2026-11-12T08:00:00+08:00')
  assert.equal(nextLaunchInstant([{ scheduledLaunchAt: '2026-11-12T08:00:00+08:00' }], now), at)
  assert.equal(nextLaunchInstant([{ nextPublishAt: '2020-01-01T00:00:00+08:00' }], now), null)
})
