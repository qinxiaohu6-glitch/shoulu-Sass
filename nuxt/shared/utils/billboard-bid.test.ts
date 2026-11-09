import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  amountToTakeRank,
  billboardBidDraft,
  clampBillboardBid,
  faviconForUrl,
  productNameFromUrl,
  rankForPayment,
  type BidOccupant,
} from './billboard-bid.ts'

/**
 * Occupants from the bid-test snapshot, in rank order.
 * #1 $30, #2 $27, #3 $26, #4 $25, #5 $20, #6 $15, #7 $10.
 */
const board: BidOccupant[] = [
  { url: 'https://one.example', amountCents: 3000, paidAt: 1 },
  { url: 'https://two.example', amountCents: 2700, paidAt: 2 },
  { url: 'https://three.example', amountCents: 2600, paidAt: 3 },
  { url: 'https://four.example', amountCents: 2500, paidAt: 4 },
  { url: 'https://five.example', amountCents: 2000, paidAt: 5 },
  { url: 'https://six.example', amountCents: 1500, paidAt: 6 },
  { url: 'https://seven.example', amountCents: 1000, paidAt: 7 },
]

test('aim rank is occupant + $1, and the $15 floor wins when that is higher', () => {
  assert.equal(amountToTakeRank(1, board), 3100)
  assert.equal(amountToTakeRank(2, board), 2800)
  assert.equal(amountToTakeRank(5, board), 2100)
  assert.equal(amountToTakeRank(6, board), 1600)
  assert.equal(amountToTakeRank(7, board), 1500)
  assert.equal(rankForPayment(3100, board).rank, 1)
  assert.equal(rankForPayment(2100, board).rank, 5)
  assert.equal(rankForPayment(1500, board).rank, 7)
  assert.equal(rankForPayment(5000, board).rank, 1)
  assert.equal(rankForPayment(1000, board).chargeCents, 1500)
  assert.equal(rankForPayment(1000, board).rank, 7)
})

test('a same-URL top-up stacks before the rank is predicted', () => {
  const payment = amountToTakeRank(1, board, 'https://www.six.example')
  assert.equal(payment, 1600)
  const landed = rankForPayment(payment, board, 'https://six.example/')
  assert.equal(landed.totalCents, 3100)
  assert.equal(landed.rank, 1)
})

test('the floor clamps, fractional dollars are refused, and the name comes from the host', () => {
  assert.equal(clampBillboardBid(1000), 1500)
  assert.equal(clampBillboardBid(3100), 3100)
  assert.equal(clampBillboardBid(1550), null)
  assert.equal(clampBillboardBid(1_000_001), null)
  assert.equal(productNameFromUrl('https://pancake.waffo.ai'), 'Pancake')
  assert.match(faviconForUrl('https://pancake.waffo.ai'), /google\.com\/s2\/favicons\?domain=pancake\.waffo\.ai/)
  const draft = billboardBidDraft({
    url: 'https://pancake.waffo.ai',
    email: 'Buyer@Example.com',
    amountCents: 1000,
  })
  assert.equal(draft?.amountCents, 1500)
  assert.equal(draft?.name, 'Pancake')
  assert.equal(draft?.published, false)
  assert.equal(draft?.paidAt, null)
  assert.equal(billboardBidDraft({ url: 'javascript:alert(1)', email: 'a@b.co', amountCents: 1500 }), null)
})
