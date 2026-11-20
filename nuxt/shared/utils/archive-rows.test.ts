import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { liveRankingRows } from './archive-rows.ts'

const listings = [
  { slug: 'peachchat', name: 'PeachChat' },
  { slug: 'callfreechat', name: 'CallFreeChat' },
]

test('an archived row whose listing is gone is dropped', () => {
  // The archive keeps the slug that was live that week, so a deleted listing
  // would otherwise print its slug as the product name and link to a 404.
  const rows = liveRankingRows(
    [
      { slug: 'peachchat-private-1v1-video-call-with-verified-g', votes: 2 },
      { slug: 'callfreechat', votes: 1 },
    ],
    listings,
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0]!.slug, 'callfreechat')
  assert.equal(rows[0]!.tool.name, 'CallFreeChat')
})

test('order and votes are kept exactly as archived', () => {
  const rows = liveRankingRows(
    [
      { slug: 'peachchat', votes: 2, rank: 1 },
      { slug: 'callfreechat', votes: 1, rank: 3 },
    ],
    listings,
  )
  assert.deepEqual(
    rows.map((row) => [row.slug, row.votes, row.rank]),
    [
      ['peachchat', 2, 1],
      ['callfreechat', 1, 3],
    ],
  )
})

test('a missing or empty ranking is not an error', () => {
  assert.deepEqual(liveRankingRows(undefined, listings), [])
  assert.deepEqual(liveRankingRows(null, listings), [])
  assert.deepEqual(liveRankingRows([], listings), [])
  assert.deepEqual(liveRankingRows([{ slug: 'peachchat' }], []), [])
})

test('the slug is only trusted for an exact match', () => {
  assert.equal(liveRankingRows([{ slug: 'peachchat-private' }], listings).length, 0)
  assert.equal(liveRankingRows([{ slug: 'PeachChat' }], listings).length, 0)
})

/* -------------------------------------------------------------------------
   wiring
   ------------------------------------------------------------------------- */

const here = dirname(fileURLToPath(import.meta.url))
const read = (rel: string) => readFileSync(join(here, rel), 'utf8')

test('every surface that renders an archive uses the filter', () => {
  for (const page of ['../../app/pages/index.vue', '../../app/pages/pricing.vue', '../../app/pages/weekly.vue']) {
    const source = read(page)
    assert.match(source, /liveRankingRows\(/, `${page} must filter archived rows`)
    assert.ok(
      !/\?\? row\.slug/.test(source),
      `${page} must not fall back to printing the slug as a name`,
    )
  }
})

test('a retired address redirects instead of 404ing', () => {
  const endpoint = read('../../server/api/directory/[slug].get.ts')
  assert.match(endpoint, /reason: 'moved', to: target/)
  assert.match(endpoint, /FROM product_slug_alias WHERE slug = \?/)

  const page = read('../../app/pages/products/[slug].vue')
  assert.match(page, /reason === 'moved'/)
  assert.match(page, /redirectCode: 301/)
})
