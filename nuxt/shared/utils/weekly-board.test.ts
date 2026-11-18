import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { isoWeekId, previousIsoWeekId, recentIsoWeeks } from './iso-week.ts'
import { compareIsoWeek, rankOpenWeek, weekFromQuery, weekPresentation } from './weekly-board.ts'

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

test('homepage renders one board grouped by week, paid rows highlighted, no month tab', () => {
  const home = read('../../app/pages/index.vue')
  assert.match(home, /useBoardData\(/)
  assert.equal(home.includes('shanghaiWeekRange'), false)
  assert.equal(home.includes('No launches this week'), false)
  assert.equal(home.includes('Schedule opens soon'), false)
  assert.equal(home.includes('votes_week'), false)
  // The two split tabs are gone; one list is grouped by ISO week.
  assert.equal(home.includes('This month · Newest'), false)
  assert.equal(home.includes('本月 · 最新'), false)
  assert.equal(home.includes("windowFilter"), false)
  assert.match(home, /weekGroups/)
  assert.match(home, /pb-week-head/)
  assert.match(home, /No votes on the board yet\./)
  assert.match(home, /pb-row--podium/)
  // Each week lists the products listed in that week (real created_at), not
  // only the few with votes — so every launch shows and none repeat across weeks.
  assert.match(home, /weekOfCreatedAt/)
  assert.match(home, /created_at/)
  assert.match(home, /isoWeekId/)
  assert.match(home, /votesBySlug/)
  // Paid/boosted rows are pinned and highlighted inside each week.
  assert.match(home, /aPaid/)
  assert.match(home, /BOOST/)
  // The last week's podium rail reads the archive, not invented numbers.
  assert.match(home, /lastWeekTop3/)
  // The podium rail must not blow past the 280px right column (horizontal scroll).
  assert.match(home, /grid-template-columns:\s*minmax\(0,\s*1fr\)/)
})

test('the podium rail grid is width-constrained so long descriptions truncate', () => {
  const home = read('../../app/pages/index.vue')
  const listRule = home.match(/\.pb-top3__list \{[^}]*\}/)
  assert.ok(listRule, 'pb-top3__list rule exists')
  assert.match(listRule![0], /grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  assert.match(listRule![0], /display:\s*grid/)
  const bodyRule = home.match(/\.pb-top3__body \{[^}]*\}/)
  assert.ok(bodyRule, 'pb-top3__body rule exists')
  assert.match(bodyRule![0], /min-width:\s*0/)
})

test('homepage shows one week at a time with a switcher, not an infinite stack', () => {
  const home = read('../../app/pages/index.vue')
  // The time machine is a real component; the board resolves the selected week.
  assert.match(home, /<WeekSwitcher/)
  assert.match(home, /activeWeekId/)
  assert.match(home, /availableWeeks/)
  assert.match(home, /boardData\.value\.week/)
  // One group only — the weekGroups function returns a single-element array.
  assert.match(home, /return \[\{\s*id,/)
  // No more stacked multi-week loop over history for the main feed.
  assert.equal(home.includes('for (const week of payload.history'), false)
  // URL weeks use the competitor's ?year=&week= form.
  assert.match(home, /weekFromQuery|year=|week=/)
})

test('WeekSwitcher links every week and highlights the active one', () => {
  const sw = read('../../app/components/WeekSwitcher.vue')
  assert.match(sw, /weekTo/)
  assert.match(sw, /year: String/)
  assert.match(sw, /week: String/)
  assert.match(sw, /is-active/)
  assert.match(sw, /aria-current/)
  // prev/next arrows and the calendar picker exist.
  assert.match(sw, /prevWeek/)
  assert.match(sw, /nextWeek/)
  assert.match(sw, /calendar-btn/)
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

test('board route defaults to the current week and accepts ?year=&week=', () => {
  const route = read('../../server/api/board.get.ts')
  assert.match(route, /weekFromQuery/)
  assert.match(route, /isIsoWeekId\(week\)/)
  assert.equal(route.includes('latestArchive'), false)
  const util = read('../../shared/utils/weekly-board.ts')
  assert.match(util, /export function weekFromQuery/)
})

test('weekFromQuery accepts ISO and competitor year/week query forms', () => {
  assert.equal(weekFromQuery({ week: '2026-W46' }), '2026-W46')
  assert.equal(weekFromQuery({ year: '2026', week: '46' }), '2026-W46')
  assert.equal(weekFromQuery({ year: '2026', week: '6' }), '2026-W06')
  assert.equal(weekFromQuery({ year: '2026', week: '1' }), '2026-W01')
  assert.equal(weekFromQuery({ year: '2026', week: '54' }), '')
  assert.equal(weekFromQuery({ year: '20x6', week: '46' }), '')
  assert.equal(weekFromQuery({ week: 'latest' }), '')
  assert.equal(weekFromQuery({}), '')
})

test('recentIsoWeeks returns the open week last and one-week exclusive ranges', () => {
  const weeks = recentIsoWeeks(new Date('2026-11-18T09:00:00.000Z'), 6)
  assert.deepEqual(
    weeks.map((week) => week.id),
    ['2026-W42', '2026-W43', '2026-W44', '2026-W45', '2026-W46', '2026-W47'],
  )
  for (const week of weeks) {
    assert.equal(week.end - week.start, 7 * 86_400_000)
    assert.ok(new Date(week.start).toISOString().endsWith('T00:00:00.000Z'))
    assert.equal(new Date(week.start).getUTCDay(), 1)
  }
  // A timestamp on the boundary belongs to the later week only.
  const w46 = weeks.find((week) => week.id === '2026-W46')!
  const w47 = weeks.find((week) => week.id === '2026-W47')!
  assert.equal(w46.end, w47.start)
})

test('the board strip headline counts listings, not votes', () => {
  const strip = read('../../app/components/WeeklyPulse.vue')
  assert.match(strip, /本周新收录/)
  assert.match(strip, /launch_weeks/)
  assert.equal(strip.includes('weekVotes'), false)
  assert.equal(strip.includes('本周票数'), false)
  const stats = read('../../server/utils/stats.ts')
  assert.match(stats, /loadEligibleListedAt/)
  assert.match(stats, /launch_weeks: launchWeeks/)
})
