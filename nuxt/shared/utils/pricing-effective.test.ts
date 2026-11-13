import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { CAMPAIGN, campaignActive } from '../content/campaign.ts'
import { AD_WEEK_OPTIONS } from '../content/pricing.ts'
import { BILLBOARD_FLOOR_CENTS } from './billboard-bid.ts'
import { effectiveAmountCents, effectiveQuote, listAmountCents } from './pricing-effective.ts'

const here = dirname(fileURLToPath(import.meta.url))
const before = Date.parse('2026-12-01T06:58:59+08:00')
const atEnd = Date.parse(CAMPAIGN.endsAt)

test('launch pricing charges the new list price and strikes the old list price', () => {
  assert.equal(CAMPAIGN.off, 0)
  assert.equal(BILLBOARD_FLOOR_CENTS, 1000)
  assert.deepEqual([...AD_WEEK_OPTIONS], [1, 4])
  assert.equal(campaignActive(before), true)
  assert.equal(effectiveAmountCents('listing', 'free', before), 0)
  assert.equal(effectiveAmountCents('listing', 'standard', before), 900)
  assert.equal(effectiveAmountCents('listing', 'featured', before), 1900)
  assert.equal(effectiveAmountCents('listing', 'pro', before), 2900)
  assert.equal(effectiveAmountCents('sidebar', '1', before), 900)
  assert.equal(effectiveAmountCents('sidebar', '4', before), 3200)
  assert.equal(effectiveAmountCents('sidebar', '2', before), 0)
  assert.equal(effectiveAmountCents('billboard', 'floor', before), 1000)
  assert.equal(effectiveAmountCents('billboard', 'entry', before), 1500)
  assert.equal(effectiveQuote('listing', 'standard', before).priceLabel, '$9')
  assert.equal(effectiveQuote('listing', 'standard', before).strikeLabel, '$19')
  assert.equal(effectiveQuote('listing', 'standard', before).amountCents, listAmountCents('listing', 'standard'))
  assert.equal(effectiveQuote('listing', 'featured', before).priceLabel, '$19')
  assert.equal(effectiveQuote('listing', 'featured', before).strikeLabel, '$39')
  assert.equal(effectiveQuote('listing', 'pro', before).priceLabel, '$29')
  assert.equal(effectiveQuote('listing', 'pro', before).strikeLabel, '$69')
  assert.equal(effectiveQuote('sidebar', '1', before).priceLabel, '$9')
  assert.equal(effectiveQuote('sidebar', '1', before).strikeLabel, '$19')
  assert.equal(effectiveQuote('sidebar', '4', before).priceLabel, '$32')
  assert.equal(effectiveQuote('sidebar', '4', before).strikeLabel, null)
  assert.equal(effectiveQuote('billboard', 'floor', before).priceLabel, '$10')
  assert.equal(effectiveQuote('billboard', 'floor', before).strikeLabel, null)
  assert.equal(effectiveQuote('billboard', 'entry', before).strikeLabel, null)
})

test('the campaign clock drops the strike and keeps the new charge', () => {
  assert.equal(effectiveAmountCents('listing', 'standard', atEnd), 900)
  assert.equal(effectiveAmountCents('billboard', 'floor', atEnd), 1000)
  assert.equal(effectiveAmountCents('sidebar', '4', atEnd), listAmountCents('sidebar', '4'))
  assert.equal(effectiveQuote('listing', 'standard', atEnd).priceLabel, '$9')
  assert.equal(effectiveQuote('listing', 'standard', atEnd).strikeLabel, null)
  assert.equal(campaignActive(before, false), false)
})

test('user-facing copy no longer sells the Black Friday percent-off', () => {
  const files = [
    '../../app/components/BlackFridayDeal.vue',
    '../../app/components/BlackFridayBar.vue',
    '../../app/components/CampaignFloat.vue',
    '../../app/pages/pricing.vue',
    '../../app/pages/billboard.vue',
    '../../app/pages/index.vue',
    '../../app/pages/faq.vue',
    '../../app/pages/rules.vue',
    '../../app/pages/advertise.vue',
    '../../app/pages/book-ad.vue',
    '../../shared/content/legal.ts',
    '../../server/routes/llms.txt.ts',
    '../../shared/utils/home-offers.ts',
  ]
  const banned = [
    '~30% OFF',
    '30% off',
    '50% off everything',
    '$34',
    '$65',
    '$13',
    'does not lower',
    '不降低',
    '地板不变',
    '不减地板',
    'Launch pricing',
    'LAUNCH PRICING',
    '上线定价',
    'cold-start',
    'Cold-start',
    '冷启动',
    '地板',
  ]
  for (const file of files) {
    const text = readFileSync(join(here, file), 'utf8')
    for (const phrase of banned) {
      assert.equal(text.includes(phrase), false, `${file} still contains ${phrase}`)
    }
    const amounts = text.matchAll(/\$29/g)
    for (const hit of amounts) {
      const window = text.slice(Math.max(0, hit.index - 80), hit.index)
      assert.match(window, /Pro|专业/, `${file} has a bare $29`)
    }
  }
})

test('the claim dialog names its minimum from the bid floor constant', () => {
  const dialog = readFileSync(join(here, '../../app/components/BillboardClaimDialog.vue'), 'utf8')
  assert.match(dialog, /const floorLabel = centsLabel\(BILLBOARD_FLOOR_CENTS\)/)
  assert.match(dialog, /Name your amount, from \$\{floorLabel\}/)
  assert.match(dialog, /自己出价，从 \$\{floorLabel\} 起/)
  assert.equal(dialog.includes('from 15'), false)
  assert.equal(dialog.includes('从 15'), false)
  assert.equal(dialog.includes('ref(15)'), false)
})

test('fixed checkouts ignore a client amount; Billboard clamps a bid and does not discount it', () => {
  const listing = readFileSync(join(here, '../../server/api/payments/checkout.post.ts'), 'utf8')
  const ad = readFileSync(join(here, '../../server/api/payments/ad-checkout.post.ts'), 'utf8')
  const board = readFileSync(join(here, '../../server/api/billboard/checkout.post.ts'), 'utf8')
  for (const source of [listing, ad]) {
    assert.match(source, /effectiveAmountCents\(/)
    assert.equal(/body\??\.(amount|price|amount_cents)/.test(source), false)
  }
  assert.match(listing, /amount_cents: amountCents/)
  assert.match(board, /billboardBidDraft\(/)
  assert.match(board, /plan: 'billboard'/)
  assert.match(board, /published: false/)
  assert.equal(/effectiveAmountCents\(/.test(board), false)
  assert.equal(/saleCents\(/.test(board), false)
})
