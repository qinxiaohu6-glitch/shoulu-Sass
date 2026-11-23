/**
 * Traffic storage against a real SQLite database.
 *
 * The DDL is lifted out of `schema.sql` rather than retyped, so a column rename
 * in one place cannot keep passing in the other. What is pinned here:
 *
 *  - a view increments its hour, and a second view in the same hour increments
 *    the same row instead of adding one (the strip would otherwise count hours
 *    instead of views);
 *  - two views from one visitor in a day count twice but make one visitor;
 *  - "live now" is the last five minutes, and a repeat view moves that moment
 *    instead of adding a second visitor;
 *  - the 24-hour window is exactly the 24 buckets, missing hours read as 0 and
 *    are still on the line;
 *  - the week figure covers seven days and stops at the boundary;
 *  - old visitor rows are pruned, so the table cannot grow without limit;
 *  - an empty database reports `has_data: false` so the page can say "counting
 *    since today" instead of printing a confident zero.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { Db, DbStatement } from './db.ts'
import { addPageView, pruneVisitors, readTraffic } from './traffic.ts'

const here = dirname(fileURLToPath(import.meta.url))

function trafficDdl(): string {
  const schema = readFileSync(join(here, '../database/schema.sql'), 'utf8')
  const tables = ['traffic_hour', 'traffic_visitor'].map((name) => {
    const start = schema.indexOf(`CREATE TABLE IF NOT EXISTS ${name}`)
    assert.ok(start > -1, `schema.sql has no ${name} table`)
    const end = schema.indexOf(');', start)
    assert.ok(end > start, `${name} CREATE TABLE is unterminated`)
    return schema.slice(start, end + 2)
  })
  return tables.join('\n')
}

function memoryDb(): Db {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(trafficDdl())
  return {
    prepare(sql: string): DbStatement {
      const stmt = sqlite.prepare(sql)
      let bound: unknown[] = []
      const api: DbStatement = {
        bind(...values: unknown[]) {
          bound = values
          return api
        },
        async first<T>() {
          return (stmt.get(...(bound as [])) as T | undefined) ?? null
        },
        async all<T>() {
          return { results: stmt.all(...(bound as [])) as T[] }
        },
        async run() {
          const info = stmt.run(...(bound as []))
          return { changes: Number(info.changes ?? 0) }
        },
      }
      return api
    },
    async exec(sql: string) {
      sqlite.exec(sql)
    },
  }
}

/** `at('2026-11-23T20:10')` — a real instant, because `seen_at` needs one. */
const at = (iso: string) => new Date(`${iso}:00.000Z`)

const NOW = new Date('2026-11-23T20:41:00.000Z')
const WEEK_START = new Date('2026-11-23T00:00:00.000Z')

test('an empty counter reports no data rather than a zero', async () => {
  const db = memoryDb()
  const summary = await readTraffic(db, NOW, WEEK_START)
  assert.equal(summary.has_data, false)
  assert.equal(summary.views_24h, 0)
  assert.equal(summary.views_week, 0)
  assert.equal(summary.live_now, 0)
  assert.equal(summary.peak, 0)
  assert.equal(summary.hourly.length, 24)
  assert.deepEqual(summary.hourly, new Array(24).fill(0))
})

test('views land in their hour and add up', async () => {
  const db = memoryDb()
  await addPageView(db, at('2026-11-23T20:10'), 'v1')
  await addPageView(db, at('2026-11-23T20:20'), 'v2')
  await addPageView(db, at('2026-11-23T19:05'), 'v1')

  const summary = await readTraffic(db, NOW, WEEK_START)
  assert.equal(summary.has_data, true)
  assert.equal(summary.views_24h, 3)
  // The line is 24 slots long and the two busy hours sit at the end of it.
  assert.equal(summary.hourly.length, 24)
  assert.equal(summary.hourly[23], 2)
  assert.equal(summary.hourly[22], 1)
  assert.equal(summary.hourly[0], 0)
  // The peak is the busiest single hour, which is what the strip prints.
  assert.equal(summary.peak, 2)
})

test('one visitor twice in a day is one visitor', async () => {
  const db = memoryDb()
  await addPageView(db, at('2026-11-23T09:10'), 'same')
  await addPageView(db, at('2026-11-23T18:10'), 'same')
  await addPageView(db, at('2026-11-23T18:20'), 'other')

  const summary = await readTraffic(db, NOW, WEEK_START)
  assert.equal(summary.views_24h, 3)
  assert.equal(summary.visitors_today, 2)
})

test('a visitor on another day is a separate row and does not inflate today', async () => {
  const db = memoryDb()
  await addPageView(db, at('2026-11-22T09:10'), 'same')
  await addPageView(db, at('2026-11-23T09:10'), 'same')

  const summary = await readTraffic(db, NOW, WEEK_START)
  assert.equal(summary.visitors_today, 1)
  // The 22nd at 09:00 is 35 hours before the window closes, so only today's
  // view is on the line — the two are separate days for the visitor count and
  // separate windows for the traffic count.
  assert.equal(summary.views_24h, 1)
})

test('the week figure covers the seven days and nothing outside them', async () => {
  const db = memoryDb()
  await addPageView(db, at('2026-11-22T23:10'), 'a') // the hour before the week starts
  await addPageView(db, at('2026-11-23T00:10'), 'b') // first hour of the week
  await addPageView(db, at('2026-11-29T23:10'), 'c') // last hour of the week
  await addPageView(db, at('2026-11-30T00:10'), 'd') // first hour after it

  const summary = await readTraffic(db, NOW, WEEK_START)
  assert.equal(summary.views_week, 2)
})

test('hours outside the 24-hour window stay off the line', async () => {
  const db = memoryDb()
  await addPageView(db, at('2026-11-21T20:10'), 'old') // 48 hours before NOW
  const summary = await readTraffic(db, NOW, WEEK_START)
  assert.equal(summary.has_data, true)
  assert.equal(summary.views_24h, 0)
})

test('"live now" is the last five minutes, and a repeat view moves the moment', async () => {
  const db = memoryDb()
  await addPageView(db, at('2026-11-23T20:10'), 'stale') // 31 minutes ago
  await addPageView(db, at('2026-11-23T20:40'), 'fresh') // one minute ago

  let summary = await readTraffic(db, NOW, WEEK_START)
  assert.equal(summary.live_now, 1)

  // The same visitor coming back is not a second person online.
  await addPageView(db, at('2026-11-23T20:41'), 'fresh')
  summary = await readTraffic(db, NOW, WEEK_START)
  assert.equal(summary.live_now, 1)
  assert.equal(summary.visitors_today, 2)

  // ...and going quiet drops them out of it again.
  const later = new Date('2026-11-23T20:52:00.000Z')
  summary = await readTraffic(db, later, WEEK_START)
  assert.equal(summary.live_now, 0)
})

test('old visitor rows are pruned so the table cannot grow forever', async () => {
  const db = memoryDb()
  await addPageView(db, at('2026-10-01T12:00'), 'ancient')
  await addPageView(db, at('2026-11-20T12:00'), 'recent')

  await pruneVisitors(db, NOW)
  const rows = await db.prepare('SELECT day FROM traffic_visitor').all<{ day: string }>()
  assert.deepEqual(
    rows.results.map((row) => row.day),
    ['2026-11-20'],
  )
})
