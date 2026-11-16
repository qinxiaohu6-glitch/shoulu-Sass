/**
 * Login-vote and archive regression.
 *
 * Uses an in-memory SQLite database with the same statements as D1.
 * Anonymous rejection is the HTTP gate (`denyAnonymousVote`), not a silent
 * no-op inside `castVote`.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { isoWeekId } from '../../shared/utils/iso-week.ts'
import { loadBoardPayload } from './board-week.ts'
import type { Db, DbStatement } from './db.ts'
import { castVote, countWeekVotes, denyAnonymousVote, voteCounts } from './votes.ts'

const here = dirname(fileURLToPath(import.meta.url))

function memoryDb(): Db {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`
    CREATE TABLE votes (
      week TEXT NOT NULL,
      slug TEXT NOT NULL,
      voter TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (week, slug, voter)
    );
    CREATE TABLE week_archive (
      week TEXT NOT NULL,
      slug TEXT NOT NULL,
      votes INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (week, slug)
    );
  `)
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
          const row = stmt.get(...(bound as [])) as T | undefined
          return row ?? null
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

const W46_OPEN = new Date('2026-11-11T15:00:00.000Z')
const W47_OPEN = new Date('2026-11-16T00:00:00.000Z')

test('a signed-in vote increments and shows on the open board', async () => {
  const db = memoryDb()
  const eligible = new Map<string, number>([['alpha', 10], ['paid-listing', 1]])
  const cast = await castVote(db, '2026-W46', 'alpha', 'sub:user-1')
  assert.equal(cast.accepted, true)
  assert.equal(cast.votes, 1)
  assert.equal(isoWeekId(W46_OPEN), '2026-W46')

  const board = await loadBoardPayload(db, isoWeekId(W46_OPEN), W46_OPEN, eligible)
  assert.equal(board.week.id, '2026-W46')
  assert.equal(board.source, 'live')
  assert.deepEqual(board.week.ranking.map((row) => [row.slug, row.votes, row.rank]), [['alpha', 1, 1]])
  assert.equal(board.current.id, '2026-W46')
  // A paid listing with no votes is not inserted into the ranked board.
  assert.equal(board.week.ranking.some((row) => row.slug === 'paid-listing'), false)
})

test('anonymous votes are rejected and do not change the count', async () => {
  const db = memoryDb()
  await castVote(db, '2026-W46', 'alpha', 'sub:user-1')
  const before = await countWeekVotes(db, '2026-W46')

  const denied = denyAnonymousVote(null)
  assert.equal(denied?.status, 401)
  assert.equal(denied?.reason, 'signin_required')
  assert.equal(denyAnonymousVote('')?.reason, 'signin_required')
  assert.equal(denyAnonymousVote('sub:user-1'), null)

  const ignored = await castVote(db, '2026-W46', 'alpha', '')
  assert.equal(ignored.accepted, false)
  assert.equal(await countWeekVotes(db, '2026-W46'), before)

  const route = readFileSync(join(here, '../api/vote.post.ts'), 'utf8')
  const gate = route.indexOf('denyAnonymousVote')
  const cast = route.indexOf('castVote(')
  assert.ok(gate > -1 && cast > gate)
  assert.match(route, /setResponseStatus\(event, denied\.status\)/)
  assert.match(route, /reason: denied\.reason/)
  assert.match(readFileSync(join(here, './votes.ts'), 'utf8'), /signin_required/)
})

test('the same user, product, and week does not accumulate', async () => {
  const db = memoryDb()
  const first = await castVote(db, '2026-W46', 'alpha', 'sub:user-1')
  const second = await castVote(db, '2026-W46', 'alpha', 'sub:user-1')
  assert.equal(first.accepted, true)
  assert.equal(second.accepted, false)
  assert.equal(second.votes, 1)
  assert.equal(await countWeekVotes(db, '2026-W46'), 1)
  const counts = await voteCounts(db, '2026-W46')
  assert.equal(counts.alpha, 1)
})

test('a new ISO week starts a new count and keeps the old week', async () => {
  const db = memoryDb()
  await castVote(db, '2026-W46', 'alpha', 'sub:user-1')
  await castVote(db, '2026-W47', 'alpha', 'sub:user-1')
  assert.equal((await voteCounts(db, '2026-W46')).alpha, 1)
  assert.equal((await voteCounts(db, '2026-W47')).alpha, 1)
  assert.equal(await countWeekVotes(db, '2026-W46'), 1)
  assert.equal(await countWeekVotes(db, '2026-W47'), 1)

  const again = await castVote(db, '2026-W47', 'alpha', 'sub:user-1')
  assert.equal(again.accepted, false)
  assert.equal(await countWeekVotes(db, '2026-W46'), 1)
})

test('week_votes is the current ISO week total from the votes table', async () => {
  const db = memoryDb()
  await castVote(db, isoWeekId(W47_OPEN), 'alpha', 'sub:a')
  await castVote(db, isoWeekId(W47_OPEN), 'beta', 'sub:b')
  await castVote(db, '2026-W46', 'alpha', 'sub:a')
  const counts = await voteCounts(db, isoWeekId(W47_OPEN))
  const sum = Object.values(counts).reduce((total, n) => total + n, 0)
  assert.equal(await countWeekVotes(db, isoWeekId(W47_OPEN)), sum)
  assert.equal(sum, 2)
  const stats = readFileSync(join(here, './stats.ts'), 'utf8')
  assert.match(stats, /countWeekVotes\(db, isoWeekId\(now\)\)/)
})

test('W45 stays archived and W46 backfills the five votes', async () => {
  const db = memoryDb()
  await db.prepare(
    'INSERT INTO week_archive (week, slug, votes, rank, created_at) VALUES (?,?,?,?,?)',
  ).bind('2026-W45', 'deepcheck', 1, 1, 111).run()
  await db.prepare(
    'INSERT INTO week_archive (week, slug, votes, rank, created_at) VALUES (?,?,?,?,?)',
  ).bind('2026-W45', 'peachchat-private-1v1-video-call-with-verified-g', 1, 2, 111).run()

  // Votes that would reverse W45 if it were recalculated. It must not be.
  await db.prepare(
    'INSERT INTO votes (week, slug, voter, created_at) VALUES (?,?,?,?)',
  ).bind('2026-W45', 'peachchat-private-1v1-video-call-with-verified-g', 'sub:early', 1).run()
  await db.prepare(
    'INSERT INTO votes (week, slug, voter, created_at) VALUES (?,?,?,?)',
  ).bind('2026-W45', 'deepcheck', 'sub:late', 99).run()

  const w46 = [
    ['peachchat-private-1v1-video-call-with-verified-g', 'sub:p1', 100],
    ['private-1v1-video-chat-with-strangers-online', 'sub:v1', 150],
    ['private-1v1-video-chat-with-strangers-online', 'sub:v2', 250],
    ['peachchat-private-1v1-video-call-with-verified-g', 'sub:p2', 300],
    ['callfreechat', 'sub:c1', 400],
  ] as const
  for (const [slug, voter, at] of w46) {
    await db.prepare(
      'INSERT INTO votes (week, slug, voter, created_at) VALUES (?,?,?,?)',
    ).bind('2026-W46', slug, voter, at).run()
  }

  const eligible = new Map<string, number>([
    ['deepcheck', 1],
    ['peachchat-private-1v1-video-call-with-verified-g', 4],
    ['private-1v1-video-chat-with-strangers-online', 5],
    ['callfreechat', 6],
    ['paid-with-zero-votes', 0],
  ])

  assert.equal(await countWeekVotes(db, '2026-W46'), 5)
  const backfill = await loadBoardPayload(db, '2026-W46', W47_OPEN, eligible)
  assert.equal(backfill.week.id, '2026-W46')
  assert.equal(backfill.source, 'backfill')
  assert.equal(backfill.current.id, '2026-W47')
  assert.deepEqual(
    backfill.week.ranking.map((row) => [row.slug, row.votes, row.rank]),
    [
      ['private-1v1-video-chat-with-strangers-online', 2, 1],
      ['peachchat-private-1v1-video-call-with-verified-g', 2, 2],
      ['callfreechat', 1, 3],
    ],
  )
  assert.equal(backfill.week.ranking.reduce((sum, row) => sum + row.votes, 0), 5)
  assert.equal(backfill.week.label_en, 'Nov 9 – Nov 15, 2026')

  const w45 = await loadBoardPayload(db, '2026-W45', W47_OPEN, eligible)
  assert.equal(w45.week.id, '2026-W45')
  assert.equal(w45.source, 'archive')
  assert.deepEqual(
    w45.week.ranking.map((row) => [row.slug, row.votes, row.rank]),
    [
      ['deepcheck', 1, 1],
      ['peachchat-private-1v1-video-call-with-verified-g', 1, 2],
    ],
  )

  // A vote that arrives after the freeze does not rewrite the closed week.
  await db.prepare(
    'INSERT INTO votes (week, slug, voter, created_at) VALUES (?,?,?,?)',
  ).bind('2026-W46', 'callfreechat', 'sub:c2', 900).run()
  const locked = await loadBoardPayload(db, '2026-W46', W47_OPEN, eligible)
  assert.equal(locked.source, 'archive')
  assert.deepEqual(
    locked.week.ranking.map((row) => [row.slug, row.votes]),
    [
      ['private-1v1-video-chat-with-strangers-online', 2],
      ['peachchat-private-1v1-video-call-with-verified-g', 2],
      ['callfreechat', 1],
    ],
  )
  assert.equal(await countWeekVotes(db, '2026-W46'), 6)

  const archive = await db.prepare(
    'SELECT slug, votes, rank FROM week_archive WHERE week = ? ORDER BY rank ASC',
  ).bind('2026-W45').all<{ slug: string; votes: number; rank: number }>()
  assert.deepEqual(archive.results.map((row) => [row.slug, row.votes, row.rank]), [
    ['deepcheck', 1, 1],
    ['peachchat-private-1v1-video-call-with-verified-g', 1, 2],
  ])
})

test('the open week is not frozen, and a future week is empty', async () => {
  const db = memoryDb()
  await castVote(db, '2026-W47', 'alpha', 'sub:user-1')
  const eligible = new Map<string, number>([['alpha', 1]])
  const live = await loadBoardPayload(db, '2026-W47', W47_OPEN, eligible)
  assert.equal(live.source, 'live')
  assert.equal(live.week.ranking[0]?.slug, 'alpha')
  const frozen = await db.prepare('SELECT week FROM week_archive WHERE week = ?').bind('2026-W47').all()
  assert.equal(frozen.results.length, 0)

  const future = await loadBoardPayload(db, '2026-W48', W47_OPEN, eligible)
  assert.equal(future.week.id, '2026-W48')
  assert.equal(future.source, 'future')
  assert.equal(future.week.ranking.length, 0)
  assert.equal(future.current.id, '2026-W47')
})
