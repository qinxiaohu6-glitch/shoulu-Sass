import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adAfterRank } from './feed-ad.ts'

test('the sponsored row lands after third place', () => {
  assert.equal(adAfterRank(10), 3)
  assert.equal(adAfterRank(5), 3)
  assert.equal(adAfterRank(4), 3)
})

test('a short week keeps the slot, after its last row', () => {
  assert.equal(adAfterRank(3), 3)
  assert.equal(adAfterRank(2), 2)
  assert.equal(adAfterRank(1), 1)
})

test('an empty week has no slot to place', () => {
  assert.equal(adAfterRank(0), 0)
})

test('nonsense input is treated as empty rather than throwing', () => {
  assert.equal(adAfterRank(Number.NaN), 0)
  assert.equal(adAfterRank(-4), 0)
})

test('a fractional count never lands between rows', () => {
  assert.equal(adAfterRank(2.7), 2)
})
