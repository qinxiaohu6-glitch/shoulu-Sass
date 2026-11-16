/**
 * Batch 4: $9.90 for-sale fee, the paid-and-reviewed state machine,
 * valuation math, and the unconfigured-checkout sentence.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { CAMPAIGN, campaignInScope } from '../content/campaign.ts'
import {
  CHECKOUT_CLOSED_EN,
  CHECKOUT_CLOSED_ZH,
  FLIPPA_FACTS,
  FOR_SALE_AMOUNT_CENTS,
  FOR_SALE_EMPTY_PLANNED,
  FOR_SALE_EMPTY_READY,
  FOR_SALE_HELPER,
  FOR_SALE_KIND,
  LABEL_ASKING,
  LABEL_PROFIT,
  LABEL_REVENUE,
  LABEL_STACK,
  LABEL_TEAM,
  SELLER_CTA,
  forSaleAmountCents,
  forSaleEmptyState,
  forSaleProductConfigured,
} from '../content/for-sale.ts'
import { tiers } from '../content/pricing.ts'
import {
  canChangeAskingPrice,
  decideForSaleReview,
  forSaleCheckoutListingId,
  isPublicForSale,
  markPaid,
  markReviewed,
  parseAskingDollars,
  refundForSale,
  relistForSale,
  resubmitForSale,
  toPublicForSaleCard,
  unlistForSale,
  type ForSaleCycle,
} from './for-sale-state.ts'
import {
  ANNUAL_PROFIT_HIGH,
  ANNUAL_PROFIT_LOW,
  ANNUAL_PROFIT_MID,
  CHURN_DOWN_PERCENT,
  CHURN_UP_PERCENT,
  GROWTH_UP_PERCENT,
  LOW_FLOOR_MULTIPLE,
  MULTIPLE_STEP,
  VALUATION_ASSUMPTIONS,
  VALUATION_CARD_BODY,
  VALUATION_CARD_LINK,
  VALUATION_CTA,
  VALUATION_NOT_UPLOADED,
  calculateValuation,
  profitMultiples,
} from './valuation.ts'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path: string) => readFileSync(join(here, path), 'utf8')

const draft: ForSaleCycle = { status: 'draft', paidAt: null, reviewedAt: null }

test('the for-sale fee is 990 cents and is not a campaign price', () => {
  assert.equal(FOR_SALE_AMOUNT_CENTS, 990)
  assert.equal(forSaleAmountCents(), 990)
  assert.equal(forSaleAmountCents.length, 0)
  assert.equal(FOR_SALE_KIND, 'for_sale_listing')
  assert.equal(campaignInScope(FOR_SALE_KIND), false)
  assert.equal(campaignInScope('listing'), true)
  assert.deepEqual([...CAMPAIGN.scope], ['listing', 'sidebar'])
  assert.equal(CAMPAIGN.off, 0)
  assert.equal(CAMPAIGN.endsAt, '2026-12-01T06:59:00+08:00')
  assert.deepEqual(
    tiers.map((tier) => [tier.id, tier.amountCents]),
    [
      ['free', 0],
      ['standard', 900],
      ['featured', 1900],
      ['pro', 2900],
    ],
  )
  assert.equal(tiers.some((tier) => tier.amountCents === 990), false)
})

test('a directory product id does not configure the for-sale SKU', () => {
  assert.equal(forSaleProductConfigured(undefined), false)
  assert.equal(forSaleProductConfigured({}), false)
  assert.equal(forSaleProductConfigured({ '*': 'PROD_ALL' }), false)
  assert.equal(forSaleProductConfigured({ standard: 'PROD_S', featured: 'PROD_F' }), false)
  assert.equal(forSaleProductConfigured({ for_sale_listing: '  ' }), false)
  assert.equal(forSaleProductConfigured({ for_sale_listing: 'PROD_FS' }), true)
  assert.equal(forSaleEmptyState(false), FOR_SALE_EMPTY_PLANNED)
  assert.equal(forSaleEmptyState(true), FOR_SALE_EMPTY_READY)
  assert.equal(FOR_SALE_EMPTY_PLANNED.includes('you can offer it'), false)
  assert.match(FOR_SALE_EMPTY_PLANNED, /will be payable once the listing product is configured/)
})

test('checkout reads a listing id and ignores a client amount', () => {
  assert.equal(forSaleCheckoutListingId({ listing_id: 'fs_abc', amount: 1, amount_cents: 100, price: 9.9 }), 'fs_abc')
  assert.equal(forSaleCheckoutListingId({ amount_cents: 990 }), '')
  const route = read('../../server/api/for-sale/checkout.post.ts')
  assert.match(route, /forSaleAmountCents\(\)/)
  assert.match(route, /forSaleCheckoutListingId/)
  assert.equal(/body\??\.(amount|amount_cents|price)/.test(route), false)
  assert.equal(route.includes(CHECKOUT_CLOSED_EN), false)
  assert.match(route, /CHECKOUT_CLOSED_EN/)
  assert.match(route, /CHECKOUT_CLOSED_ZH/)
  assert.equal(route.includes('we will email you how to pay'), false)
  assert.equal(route.includes('Request invoice'), false)
  assert.equal(route.includes('索取发票'), false)
  assert.equal(CHECKOUT_CLOSED_EN, 'Could not open the payment page — try again in a moment.')
  assert.equal(CHECKOUT_CLOSED_ZH, '暂时打不开付款页面，请稍后再试。')
  const form = read('../../app/pages/for-sale/list.vue')
  assert.match(form, /listing_id: listingId/)
  assert.equal(/checkout[\s\S]{0,180}amount/.test(form), false)
})

test('a listing is public only after it is paid and reviewed', () => {
  assert.equal(isPublicForSale(draft), false)
  const pending = markPaid(draft, 100)
  assert.deepEqual(pending, { status: 'paid_pending_review', paidAt: 100, reviewedAt: null })
  assert.equal(isPublicForSale(pending!), false)
  assert.equal(markPaid(pending!, 200), null)
  assert.equal(markReviewed({ status: 'draft', paidAt: null, reviewedAt: null }, true, 300), null)
  assert.equal(markReviewed({ status: 'paid_pending_review', paidAt: null, reviewedAt: null }, true, 300), null)
  const rejected = markReviewed(pending!, false, 300)
  assert.equal(rejected?.status, 'rejected')
  assert.equal(isPublicForSale(rejected!), false)
  const active = markReviewed(pending!, true, 400)
  assert.deepEqual(active, { status: 'active', paidAt: 100, reviewedAt: 400 })
  assert.equal(isPublicForSale(active!), true)
  assert.equal(isPublicForSale({ status: 'active', paidAt: null, reviewedAt: 400 }), false)
  assert.equal(isPublicForSale({ status: 'active', paidAt: 100, reviewedAt: null }), false)

  const sold = unlistForSale(active!, 'sold')
  assert.equal(sold?.status, 'sold')
  assert.equal(isPublicForSale(sold!), false)
  const again = relistForSale(sold!)
  assert.deepEqual(again, { status: 'draft', paidAt: null, reviewedAt: null })
  assert.equal(isPublicForSale(again!), false)
  const repaid = markPaid(again!, 500)
  assert.equal(isPublicForSale(repaid!), false)

  const withdrawn = unlistForSale(active!, 'withdrawn')
  assert.equal(isPublicForSale(withdrawn!), false)
  assert.equal(isPublicForSale(refundForSale(active!)), false)
  assert.equal(refundForSale(active!).paidAt, null)

  assert.equal(canChangeAskingPrice(active!), true)
  assert.equal(canChangeAskingPrice(pending!), true)
  assert.equal(canChangeAskingPrice(draft), false)
  assert.equal(canChangeAskingPrice(again!), false)

  const resubmitted = resubmitForSale(rejected!)
  assert.equal(resubmitted?.status, 'paid_pending_review')
  assert.equal(resubmitted?.paidAt, 100)
  assert.equal(isPublicForSale(resubmitted!), false)
})

test('review checks ownership and spam, not the income figure', () => {
  const pending = {
    action: 'approve' as const,
    ownsProduct: true,
    paid: true,
    status: 'paid_pending_review' as const,
    spam: [] as string[],
  }
  assert.deepEqual(decideForSaleReview(pending), { ok: true, status: 'active' })
  assert.equal(decideForSaleReview({ ...pending, paid: false }).ok, false)
  assert.equal(decideForSaleReview({ ...pending, ownsProduct: false, action: 'approve' }).ok, false)
  assert.equal(decideForSaleReview({ ...pending, spam: ['too_many_links'] }).ok, false)
  assert.deepEqual(decideForSaleReview({ ...pending, action: 'reject' }), { ok: true, status: 'rejected' })
  assert.equal(decideForSaleReview({ ...pending, status: 'draft' }).ok, false)
  const huge = decideForSaleReview(pending)
  assert.equal(huge.ok, true)
})

test('the public card drops the seller email', () => {
  const card = toPublicForSaleCard({
    id: 'fs_1',
    product_slug: 'acme',
    product_name: 'Acme',
    asking_cents: 150000,
    revenue: '$1,200 / month',
    profit: '',
    team: '2',
    stack: '',
    status: 'active',
    paidAt: 1,
    reviewedAt: 2,
    interested: 3,
    owner_email: 'secret@seller.test',
    owner_sub: 'google-sub',
  })
  assert.equal(card?.interested, 3)
  const encoded = JSON.stringify(card)
  assert.equal(encoded.includes('secret@seller.test'), false)
  assert.equal(encoded.includes('owner_email'), false)
  assert.equal(encoded.includes('google-sub'), false)
  assert.equal(
    toPublicForSaleCard({
      id: 'fs_2',
      product_slug: 'acme',
      product_name: 'Acme',
      asking_cents: 100,
      revenue: '',
      profit: '',
      team: '',
      stack: '',
      status: 'paid_pending_review',
      paidAt: 1,
      reviewedAt: null,
      interested: 0,
      owner_email: 'secret@seller.test',
    }),
    null,
  )
})

test('asking price parses dollars and is not the fee', () => {
  assert.equal(parseAskingDollars('1500'), 150000)
  assert.equal(parseAskingDollars('$1,500.50'), 150050)
  assert.equal(parseAskingDollars('9.90'), 990)
  assert.equal(parseAskingDollars('0'), null)
  assert.equal(parseAskingDollars('-5'), null)
  assert.notEqual(parseAskingDollars('1500'), forSaleAmountCents())
})

test('valuation uses only the disclosed multiples', () => {
  assert.deepEqual(VALUATION_ASSUMPTIONS, [
    'These figures are Product Atlas assumptions, not an appraisal.',
    'The calculation runs in your browser and is not uploaded to our servers.',
    'We start from annual profit: low 2×, mid 3×, and high 4×.',
    'If annual growth is 20% or more, mid and high each go up by 0.5×. If growth is negative, low and mid each go down by 0.5×.',
    'If monthly churn is 5% or more, every tier goes down by 0.5×. If monthly churn is 2% or less, mid and high each go up by 0.5×.',
    'Low is never below 1× annual profit.',
    'If profit is zero or negative, we do not show a profit multiple, and we do not substitute a revenue multiple to invent a price-like number.',
  ])
  assert.equal(ANNUAL_PROFIT_LOW, 2)
  assert.equal(ANNUAL_PROFIT_MID, 3)
  assert.equal(ANNUAL_PROFIT_HIGH, 4)
  assert.equal(MULTIPLE_STEP, 0.5)
  assert.equal(GROWTH_UP_PERCENT, 20)
  assert.equal(CHURN_DOWN_PERCENT, 5)
  assert.equal(CHURN_UP_PERCENT, 2)
  assert.equal(LOW_FLOOR_MULTIPLE, 1)

  const base = calculateValuation({
    period: 'year',
    revenue: 10000,
    marginPercent: 100,
    growthPercent: 0,
    churnPercent: 3,
  })
  assert.equal(base.showMultiple, true)
  if (!base.showMultiple) return
  assert.deepEqual([base.lowMultiple, base.midMultiple, base.highMultiple], [2, 3, 4])
  assert.deepEqual([base.low, base.mid, base.high], [20000, 30000, 40000])

  const monthly = calculateValuation({
    period: 'month',
    revenue: 1000,
    marginPercent: 50,
    growthPercent: 0,
    churnPercent: 3,
  })
  assert.equal(monthly.showMultiple, true)
  if (!monthly.showMultiple) return
  assert.equal(monthly.annualProfit, 6000)
  assert.deepEqual([monthly.low, monthly.mid, monthly.high], [12000, 18000, 24000])

  assert.deepEqual(profitMultiples(20, 3), { low: 2, mid: 3.5, high: 4.5 })
  assert.deepEqual(profitMultiples(19.99, 3), { low: 2, mid: 3, high: 4 })
  assert.deepEqual(profitMultiples(-1, 3), { low: 1.5, mid: 2.5, high: 4 })
  assert.deepEqual(profitMultiples(0, 5), { low: 1.5, mid: 2.5, high: 3.5 })
  assert.deepEqual(profitMultiples(0, 4.99), { low: 2, mid: 3, high: 4 })
  assert.deepEqual(profitMultiples(0, 2), { low: 2, mid: 3.5, high: 4.5 })
  assert.deepEqual(profitMultiples(0, 2.01), { low: 2, mid: 3, high: 4 })
  assert.deepEqual(profitMultiples(20, 2), { low: 2, mid: 4, high: 5 })
  assert.deepEqual(profitMultiples(-10, 5), { low: 1, mid: 2, high: 3.5 })
  assert.ok(profitMultiples(-100, 100).low >= LOW_FLOOR_MULTIPLE)

  const flat = calculateValuation({
    period: 'year',
    revenue: 5000,
    marginPercent: 0,
    growthPercent: 80,
    churnPercent: 0,
  })
  assert.deepEqual(flat, { showMultiple: false, reason: 'non_positive_profit' })
  assert.equal('low' in flat, false)
  const loss = calculateValuation({
    period: 'month',
    revenue: 800,
    marginPercent: -10,
    growthPercent: 30,
    churnPercent: 1,
  })
  assert.equal(loss.showMultiple, false)
  if (loss.showMultiple) return
  assert.equal(loss.reason, 'non_positive_profit')

  const source = read('./valuation.ts')
  assert.equal(/revenueMultiple|REVENUE_MULTIPLE|ARR_MULTIPLE/.test(source), false)
})

test('approved for-sale, valuation, and Flippa sentences are on the pages', () => {
  const list = read('../../app/pages/for-sale/index.vue')
  const calc = read('../../app/pages/tools/saas-valuation-calculator.vue')
  const flippa = read('../../app/pages/alternatives/flippa.vue')
  const tools = read('../../app/pages/tools/index.vue')
  const pricing = read('../../app/pages/pricing.vue')
  const webhook = read('../../server/api/payments/webhook.post.ts')
  assert.equal(FOR_SALE_HELPER.includes('in this release'), false)
  assert.match(list, /FOR_SALE_HELPER/)
  assert.match(list, /forSaleEmptyState/)
  assert.match(list, /SELLER_CTA/)
  assert.equal(SELLER_CTA, 'List a product for sale · $9.90')
  assert.match(calc, /calculateValuation/)
  assert.match(calc, /VALUATION_ASSUMPTIONS/)
  assert.match(calc, /@submit\.prevent="onCalculate"/)
  assert.equal(calc.includes('$fetch'), false)
  assert.match(calc, /VALUATION_CTA/)
  assert.match(calc, /VALUATION_NOT_UPLOADED/)
  assert.equal(VALUATION_CTA, 'Calculate range')
  assert.equal(VALUATION_NOT_UPLOADED, 'Nothing is uploaded to our servers.')
  assert.match(tools, new RegExp(VALUATION_CARD_BODY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(tools, /Open the calculator →/)
  assert.equal(VALUATION_CARD_LINK, 'Open the calculator →')
  assert.deepEqual([...FLIPPA_FACTS], [
    '$9.90 once per product, until you unlist it.',
    'No commission.',
    'This page has no escrow. Buyer and seller settle payment and handover themselves.',
    'Income figures are seller-reported.',
    'Contact happens after the buyer signs in; we do not publish the seller\u2019s email.',
  ])
  assert.match(flippa, /FLIPPA_FACTS/)
  assert.equal(flippa.includes('No escrow in this release'), false)
  assert.equal(flippa.includes('ShipAny'), false)
  assert.match(flippa, /Long-form comparison/)
  assert.match(pricing, /localePath\('\/for-sale'\)/)
  assert.equal(pricing.includes('for_sale_listing'), false)
  const saleAt = webhook.indexOf("settled.plan === FOR_SALE_KIND")
  const confirmAt = webhook.indexOf('confirmPayment(')
  assert.ok(saleAt > 0 && confirmAt > saleAt)
  assert.match(webhook, /markForSalePaid/)
  assert.equal(webhook.includes('for-sale listing is not public'), false)
})

test('contact response does not return the seller email', () => {
  const contact = read('../../server/api/for-sale/contact.post.ts')
  assert.match(contact, /return \{ ok: true, interested \}/)
  assert.equal(contact.includes('seller_email'), false)
  const card = read('../../app/components/ForSaleCard.vue')
  assert.equal(card.includes('owner_email'), false)
  assert.equal(LABEL_ASKING, 'Asking price')
  assert.equal(LABEL_REVENUE, 'Seller-reported revenue')
  assert.equal(LABEL_PROFIT, 'Seller-reported profit')
  assert.equal(LABEL_TEAM, 'Team')
  assert.equal(LABEL_STACK, 'Stack')
  assert.match(card, /LABEL_REVENUE/)
  assert.match(card, /LABEL_PROFIT/)
  assert.match(card, /LABEL_TEAM/)
  assert.match(card, /LABEL_STACK/)
  assert.match(card, /INCOME_NOTE/)
})
