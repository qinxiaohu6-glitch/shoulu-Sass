import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyOverrideChange,
  clampListingWeight,
  compareListingOrder,
  listingRank,
  listingWeight,
  pickListingText,
  pinWindowActive,
  type OverrideFlags,
} from './listing-order.ts'

const today = '2026-11-06'

test('pin window matches the public rule', () => {
  assert.equal(pinWindowActive(undefined, today), false)
  assert.equal(pinWindowActive('', today), true)
  assert.equal(pinWindowActive('2026-11-11', today), true)
  assert.equal(pinWindowActive('2026-11-06', today), true)
  assert.equal(pinWindowActive('2026-11-05', today), false)
})

test('rank is paid, then featured or pinned, then the rest', () => {
  assert.equal(listingRank(true, false, false), 0)
  assert.equal(listingRank(true, true, true), 0)
  assert.equal(listingRank(false, true, false), 1)
  assert.equal(listingRank(false, false, true), 1)
  assert.equal(listingRank(false, false, false), 2)
})

test('weight 0 keeps the previous order inside a rank', () => {
  const items = [
    { rank: 2, sort: 0, index: 0 },
    { rank: 2, sort: 0, index: 1 },
    { rank: 1, sort: 0, index: 2 },
  ]
  const ordered = [...items].sort((a, b) =>
    compareListingOrder(a.rank, b.rank, a.sort, b.sort, a.index, b.index),
  )
  assert.deepEqual(
    ordered.map((item) => item.index),
    [2, 0, 1],
  )
})

test('a higher recommend weight rises inside the same band only', () => {
  const items = [
    { rank: 2, sort: 0, index: 0, slug: 'a' },
    { rank: 2, sort: 10, index: 1, slug: 'b' },
    { rank: 0, sort: 0, index: 2, slug: 'paid' },
  ]
  const ordered = [...items].sort((a, b) =>
    compareListingOrder(a.rank, b.rank, a.sort, b.sort, a.index, b.index),
  )
  assert.deepEqual(
    ordered.map((item) => item.slug),
    ['paid', 'b', 'a'],
  )
})

test('missing weights do not reorder', () => {
  assert.equal(listingWeight({}, 'sample'), 0)
  assert.equal(listingWeight({ sort: { sample: 4 } }, 'sample'), 4)
  assert.equal(listingWeight({ sort: { sample: Number.NaN } }, 'sample'), 0)
})

test('listing text keeps a single public description', () => {
  assert.equal(pickListingText('Atlas', 'Atlas', 'Atlas', 60), 'Atlas')
  assert.equal(pickListingText('Atlas Chat', 'Atlas', 'Atlas', 60), 'Atlas Chat')
  assert.equal(pickListingText('Atlas', '图谱', 'Atlas', 60), '图谱')
  assert.equal(pickListingText('', '', 'Atlas', 60), 'Atlas')
  assert.equal(pickListingText('<b>Atlas</b>', 'Atlas', 'Atlas', 60), 'Atlas')
  assert.equal(pickListingText('x'.repeat(80), 'Atlas', 'Atlas', 60), 'x'.repeat(60))
})

test('override changes leave the other switches alone and drop empty rows', () => {
  const pinned: OverrideFlags = {
    slug: 'sample',
    pin: 1,
    pin_until: '2026-11-11',
    hidden: 0,
    sort: 0,
    updated_at: 1,
  }

  const hidden = applyOverrideChange(pinned, 'sample', 'hidden', true, '', 2)
  assert.ok(hidden)
  assert.equal(hidden.hidden, 1)
  assert.equal(hidden.pin, 1)
  assert.equal(hidden.pin_until, '2026-11-11')

  const unpinned = applyOverrideChange(hidden, 'sample', 'pin', false, '', 3)
  assert.ok(unpinned)
  assert.equal(unpinned.pin, 0)
  assert.equal(unpinned.pin_until, '')
  assert.equal(unpinned.hidden, 1)

  const shown = applyOverrideChange(unpinned, 'sample', 'hidden', false, '', 4)
  assert.equal(shown, null)

  const weighted = applyOverrideChange(null, 'other-listing', 'sort', 8, '', 5)
  assert.ok(weighted)
  assert.equal(weighted.sort, 8)
  assert.equal(weighted.pin, 0)

  const cleared = applyOverrideChange(weighted, 'other-listing', 'sort', 0, '', 6)
  assert.equal(cleared, null)
  assert.equal(clampListingWeight(5_000_000), 1_000_000)
})
