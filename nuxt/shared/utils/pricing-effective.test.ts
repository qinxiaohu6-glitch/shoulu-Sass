import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { CAMPAIGN, campaignActive } from '../content/campaign.ts'
import { effectiveAmountCents, effectiveQuote, listAmountCents } from './pricing-effective.ts'

const here = dirname(fileURLToPath(import.meta.url))
const before = Date.parse('2026-12-01T06:58:59+08:00')
const atEnd = Date.parse(CAMPAIGN.endsAt)

test('effectiveAmountCents is the sale price for listing, sidebar and billboard', () => {
  assert.equal(campaignActive(before), true)
  assert.equal(effectiveAmountCents('listing', 'free', before), 0)
  assert.equal(effectiveAmountCents('listing', 'standard', before), 1300)
  assert.equal(effectiveAmountCents('listing', 'featured', before), 2700)
  assert.equal(effectiveAmountCents('listing', 'pro', before), 4800)
  assert.equal(effectiveAmountCents('sidebar', '1', before), 1300)
  assert.equal(effectiveAmountCents('sidebar', '4', before), 4600)
  assert.equal(effectiveAmountCents('billboard', 'entry', before), 1100)
  assert.equal(effectiveAmountCents('billboard', 'standard', before), 2000)
  assert.equal(effectiveAmountCents('billboard', 'prime', before), 3400)
  assert.equal(effectiveQuote('listing', 'featured', before).priceLabel, '$27')
  assert.equal(effectiveQuote('listing', 'featured', before).strikeLabel, '$39')
  assert.equal(effectiveQuote('billboard', 'entry', before).priceLabel, '$11')
})

test('the campaign clock falls back to the list price', () => {
  assert.equal(effectiveAmountCents('listing', 'standard', atEnd), 1900)
  assert.equal(effectiveAmountCents('billboard', 'entry', atEnd), 1500)
  assert.equal(effectiveAmountCents('sidebar', '4', atEnd), listAmountCents('sidebar', '4'))
  assert.equal(effectiveQuote('listing', 'standard', atEnd).strikeLabel, null)
  assert.equal(campaignActive(before, false), false)
})

test('checkout routes charge effectiveAmountCents and do not read a client amount', () => {
  const listing = readFileSync(join(here, '../../server/api/payments/checkout.post.ts'), 'utf8')
  const ad = readFileSync(join(here, '../../server/api/payments/ad-checkout.post.ts'), 'utf8')
  const board = readFileSync(join(here, '../../server/api/billboard/checkout.post.ts'), 'utf8')
  for (const source of [listing, ad, board]) {
    assert.match(source, /effectiveAmountCents\(/)
    assert.equal(/body\??\.(amount|price|amount_cents)/.test(source), false)
  }
  assert.match(listing, /amount_cents: amountCents/)
  assert.match(board, /plan: 'billboard'/)
  assert.match(board, /published: false/)
})
