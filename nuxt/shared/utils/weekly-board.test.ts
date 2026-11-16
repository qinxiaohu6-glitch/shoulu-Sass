import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { isoWeekId, previousIsoWeekId } from './iso-week.ts'
import { compareIsoWeek, rankOpenWeek, weekPresentation } from './weekly-board.ts'

const here = dirname(fileURLToPath(import.meta.url))
const read = (rel: string) => readFileSync(join(here, rel), 'utf8')

test('UTC Monday 00:00 switches the ISO week', () => {
  assert.equal(isoWeekId(new Date('2026-11-15T23:59:59.999Z')), '2026-W46')
  assert.equal(isoWeekId(new Date('2026-11-16T00:00:00.000Z')), '2026-W47')
  assert.equal(isoWeekId(new Date('2026-11-09T00:00:00.000Z')), '2026-W46')
  assert.equal(isoWeekId(new Date('2026-11-08T23:59:59.000Z')), '2026-W45')
  assert.equal(previousIsoWeekId(new Date('2026-11-16T00:00:00.000Z')), '2026-W46')
  assert.equal(isoWeekId(new Date('2025-12-29T00:00:00.000Z')), '2026-W01')
  assert.ok(compareIsoWeek('2026-W45', '2026-W46') < 0)
  assert.ok(compareIsoWeek('2026-W47', '2026-W46') > 0)
})

test('W46 is the UTC week Nov 9 – Nov 15, 2026', () => {
  const week = weekPresentation('2026-W46')
  assert.ok(week)
  assert.equal(week.start, '2026-11-09')
  assert.equal(week.end, '2026-11-15')
  assert.equal(week.label_en, 'Nov 9 – Nov 15, 2026')
  assert.equal(week.label_zh, '11 月 9 日 – 11 月 15 日')
  assert.equal(weekPresentation('2026-W45')?.start, '2026-11-02')
  assert.equal(weekPresentation('2026-W47')?.start, '2026-11-16')
})

test('ranked board keeps only products with a vote, in §5.2 order', () => {
  const eligible = new Map<string, number>([
    ['peachchat-private-1v1-video-call-with-verified-g', 4],
    ['private-1v1-video-chat-with-strangers-online', 5],
    ['callfreechat', 6],
    ['paid-zero', 1],
    ['newest-zero', 9],
  ])
  // Five W46 votes. The two products on 2 votes split by who reached 2 first.
  const ranked = rankOpenWeek(
    [
      { slug: 'peachchat-private-1v1-video-call-with-verified-g', createdAt: 100 },
      { slug: 'private-1v1-video-chat-with-strangers-online', createdAt: 150 },
      { slug: 'private-1v1-video-chat-with-strangers-online', createdAt: 250 },
      { slug: 'peachchat-private-1v1-video-call-with-verified-g', createdAt: 300 },
      { slug: 'callfreechat', createdAt: 400 },
      { slug: 'not-public', createdAt: 1 },
    ],
    eligible,
  )
  assert.deepEqual(
    ranked.map((row) => row.slug),
    [
      'private-1v1-video-chat-with-strangers-online',
      'peachchat-private-1v1-video-call-with-verified-g',
      'callfreechat',
    ],
  )
  assert.deepEqual(ranked.map((row) => row.votes), [2, 2, 1])
  assert.equal(ranked.reduce((sum, row) => sum + row.votes, 0), 5)
  assert.equal(ranked.some((row) => row.votes < 1), false)
  assert.deepEqual(
    ranked.map((_, index) => index + 1),
    [1, 2, 3],
  )
})

test('equal timestamps fall through to list time, then slug', () => {
  const votes = [
    { slug: 'beta', createdAt: 10 },
    { slug: 'alpha', createdAt: 10 },
    { slug: 'gamma', createdAt: 10 },
  ]
  const byList = rankOpenWeek(votes, new Map([['alpha', 5], ['beta', 1], ['gamma', 5]]))
  assert.deepEqual(byList.map((row) => row.slug), ['beta', 'alpha', 'gamma'])

  const bySlug = rankOpenWeek(
    [
      { slug: 'zeta', createdAt: 10 },
      { slug: 'able', createdAt: 10 },
    ],
    new Map([['zeta', 3], ['able', 3]]),
  )
  assert.deepEqual(bySlug.map((row) => row.slug), ['able', 'zeta'])
})

test('homepage This week uses the board, and Newest has no contest ranks', () => {
  const home = read('../../app/pages/index.vue')
  assert.match(home, /useBoardData\(/)
  assert.equal(home.includes('shanghaiWeekRange'), false)
  assert.equal(home.includes('No launches this week'), false)
  assert.equal(home.includes('Schedule opens soon'), false)
  assert.equal(home.includes('votes_week'), false)
  assert.match(home, /This month · Newest/)
  assert.match(home, /本月 · 最新/)
  assert.match(home, /No votes on the board this week\./)
  assert.match(home, /本周榜上还没有票。/)
  assert.match(home, /launch-row--newest/)
  assert.match(home, /v-if="windowFilter === 'week'"/)
})

test('weekly page reads the board API and keeps the sponsored row off the vote ranks', () => {
  const weekly = read('../../app/pages/weekly.vue')
  assert.match(weekly, /useBoardData\(/)
  assert.equal(weekly.includes('votes_week'), false)
  assert.equal(weekly.includes('Current period：'), false)
  assert.match(weekly, /Current period: /)
  assert.match(weekly, /Sponsored/)
  assert.match(weekly, /class="rank-ad"/)
  const ad = weekly.indexOf('class="rank-ad"')
  const adEnd = weekly.indexOf('</tr>', ad)
  assert.equal(weekly.slice(ad, adEnd).includes('row.rank'), false)
  assert.match(read('../../app/composables/useBoard.ts'), /\/api\/board/)
})

test('payments and ads do not write votes', () => {
  for (const rel of [
    '../../server/api/payments/checkout.post.ts',
    '../../server/api/billboard/checkout.post.ts',
    '../../server/api/payments/ad-checkout.post.ts',
  ]) {
    const text = read(rel)
    assert.equal(text.includes('castVote'), false, rel)
    assert.equal(text.includes('INTO votes'), false, rel)
  }
})

test('the Monday 03:00 UTC cron is unchanged', () => {
  const wrangler = read('../../wrangler.jsonc')
  assert.match(wrangler, /"crons": \["0 3 \* \* 1"\]/)
})

test('board route defaults to the current week and does not serve latestArchive', () => {
  const route = read('../../server/api/board.get.ts')
  assert.match(route, /raw \|\| isoWeekId\(\)/)
  assert.match(route, /isIsoWeekId\(week\)/)
  assert.equal(route.includes('latestArchive'), false)
})
