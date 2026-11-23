import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  dayOfBucket,
  hourBucket,
  isBotUserAgent,
  isCountablePath,
  isPrefetch,
  recentBuckets,
  summarizeHours,
  weekBucketRange,
} from './traffic.ts'

test('a bucket is one UTC hour, fixed width', () => {
  assert.equal(hourBucket(new Date('2026-11-23T20:41:59.999Z')), '2026-11-23T20')
  assert.equal(hourBucket(new Date('2026-01-02T00:00:00.000Z')), '2026-01-02T00')
  // Fixed width is what makes "the last 24 hours" a text range scan.
  for (const iso of ['2026-01-02T00:00:00Z', '2026-11-23T23:59:59Z']) {
    assert.equal(hourBucket(new Date(iso)).length, 13)
  }
})

test('the day of a bucket is its first ten characters', () => {
  assert.equal(dayOfBucket('2026-11-23T20'), '2026-11-23')
})

test('recentBuckets is oldest → newest and ends on the current hour', () => {
  const at = new Date('2026-11-23T20:41:59.000Z')
  const buckets = recentBuckets(at, 24)
  assert.equal(buckets.length, 24)
  assert.equal(buckets[0], '2026-11-22T21')
  assert.equal(buckets[23], '2026-11-23T20')
  // Strictly increasing by one hour, with no gaps across midnight.
  for (let i = 1; i < buckets.length; i++) {
    assert.equal(new Date(`${buckets[i]}:00:00Z`).getTime() - new Date(`${buckets[i - 1]}:00:00Z`).getTime(), 3_600_000)
  }
})

test('a week range covers exactly seven days, end exclusive', () => {
  const range = weekBucketRange(new Date('2026-11-16T00:00:00.000Z'))
  assert.deepEqual(range, { from: '2026-11-16T00', to: '2026-11-23T00' })
})

test('pages count, plumbing does not', () => {
  for (const path of ['/', '/zh', '/weekly', '/zh/products/peachchat', '/pricing', '/submit', '/spotlights/x']) {
    assert.equal(isCountablePath(path), true, path)
  }
  for (const path of [
    '/api/stats',
    '/api/board?week=2026-W47',
    '/_nuxt/entry.js',
    '/_payload.json',
    '/assets/img/logo.png',
    '/sitemap.xml',
    '/robots.txt',
    '/llms.txt',
    '/favicon.ico',
    '/admin',
    '/admin/spotlights',
    '/settings/ads',
    '/cdn-cgi/trace',
    'not-a-path',
  ]) {
    assert.equal(isCountablePath(path), false, path)
  }
})

test('crawlers and headless browsers are not visitors', () => {
  const bots = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0)',
    'Mozilla/5.0 (compatible; SemrushBot/7~bl)',
    'Mozilla/5.0 (compatible; bingbot/2.0)',
    'Mozilla/5.0 AppleWebKit/537.36 HeadlessChrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (compatible; GPTBot/1.0)',
    '',
    '   ',
  ]
  for (const ua of bots) assert.equal(isBotUserAgent(ua), true, ua)

  const humans = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ]
  for (const ua of humans) assert.equal(isBotUserAgent(ua), false, ua)
})

test('a prefetch is not a visit', () => {
  assert.equal(isPrefetch('prefetch'), true)
  assert.equal(isPrefetch('Prefetch;prerender'), true)
  assert.equal(isPrefetch(''), false)
  assert.equal(isPrefetch(undefined), false)
})

test('the headline figure is the sum of the line it sits next to', () => {
  const quiet = summarizeHours([0, 0, 0])
  assert.equal(quiet.views, 0)
  assert.equal(quiet.hasData, false)

  const busy = summarizeHours([1, 4, 0, 7])
  assert.equal(busy.views, 12)
  assert.equal(busy.peak, 7)
  assert.equal(busy.hasData, true)

  // Garbage from the database must not produce a NaN headline.
  assert.equal(summarizeHours([Number.NaN, -3, 2]).views, 2)
})
