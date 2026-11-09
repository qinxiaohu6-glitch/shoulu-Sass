import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  BILLBOARD_TIERS,
  BLACK_FRIDAY,
  billboardStandardCents,
  campaignActive,
  campaignDeadlineShanghai,
  quoteCents,
  saleCents,
} from '../content/billboard.ts'
import { adPlans, adPriceCents, planAmountCents, tiers } from '../content/pricing.ts'
import {
  billboardInvoiceDraft,
  padBillboard,
  publicBillboardRows,
  rankBillboard,
  tierPriceLabel,
  type BillboardRow,
} from './billboard.ts'

const here = dirname(fileURLToPath(import.meta.url))

function row(partial: Partial<BillboardRow> & Pick<BillboardRow, 'id' | 'tier' | 'paidAt'>): BillboardRow {
  return {
    name: partial.id,
    tagline: '',
    url: `https://${partial.id}.example`,
    logo: '',
    screenshot: '',
    status: 'live',
    ...partial,
  }
}

test('listing prices stay locked and Billboard is the only new price set', () => {
  assert.deepEqual(
    tiers.map((tier) => `${tier.id}:${tier.price}:${tier.amountCents}`),
    ['free:$0:0', 'standard:$19:1900', 'featured:$39:3900', 'pro:$69:6900'],
  )
  assert.deepEqual(
    BILLBOARD_TIERS.map((tier) => `${tier.id}:${tier.price}:${tier.amountCents}`),
    ['entry:$15:1500', 'standard:$29:2900', 'prime:$49:4900'],
  )
  assert.deepEqual(
    adPlans.map((plan) => `${plan.id}:${plan.price}:${plan.weeklyCents}`),
    ['sidebar:$19:1900'],
  )
  assert.equal(billboardStandardCents(), 2900)
  assert.equal(planAmountCents('ad'), 2900)
  assert.equal(planAmountCents('standard'), 1900)
  assert.equal(adPriceCents('sidebar', 1), 1900)
  assert.equal(adPriceCents('sidebar', 4), 6500)
  assert.equal(adPriceCents('board', 1), 0)
  assert.equal(adPriceCents('board', 4), 0)
})

test('campaign strikes the list price and stops at the deadline', () => {
  const before = Date.parse('2026-12-01T06:58:59+08:00')
  const atEnd = Date.parse(BLACK_FRIDAY.endsAt)
  assert.equal(campaignDeadlineShanghai(), '2026-12-01 06:59')
  assert.equal(campaignActive(before), true)
  assert.equal(campaignActive(atEnd), false)
  assert.equal(campaignActive(before, false), false)

  const standard = quoteCents(1900, before)
  assert.equal(standard.listLabel, '$19')
  assert.equal(standard.priceLabel, '$13')
  assert.equal(standard.strikeLabel, '$19')
  assert.equal(quoteCents(3900, before).priceLabel, '$27')
  assert.equal(quoteCents(3900, before).strikeLabel, '$39')
  assert.equal(quoteCents(6900, before).priceLabel, '$48')
  assert.equal(quoteCents(6900, before).strikeLabel, '$69')
  assert.equal(quoteCents(2900, before).priceLabel, '$20')
  assert.equal(quoteCents(4900, before).priceLabel, '$34')
  assert.equal(quoteCents(1900, before, 0).priceLabel, '$13')

  const entry = quoteCents(1500, before, 1500)
  assert.equal(entry.priceLabel, '$15')
  assert.equal(entry.strikeLabel, null)

  const after = quoteCents(1900, atEnd)
  assert.equal(after.priceLabel, '$19')
  assert.equal(after.strikeLabel, null)
  assert.equal(saleCents(0), 0)
})

test('rank is tier then first confirmed payment, and unpaid rows stay off', () => {
  const rows = [
    row({ id: 'e1', tier: 'entry', paidAt: 10 }),
    row({ id: 's-late', tier: 'standard', paidAt: 50 }),
    row({ id: 's-early', tier: 'standard', paidAt: 20 }),
    row({ id: 'p', tier: 'prime', paidAt: 90 }),
    row({ id: 'wait', tier: 'prime', paidAt: 1, status: 'requested' }),
    row({ id: 'removed', tier: 'prime', paidAt: 1, status: 'removed' }),
  ]
  const live = publicBillboardRows(rows)
  assert.deepEqual(live.map((item) => item.id), ['e1', 's-late', 's-early', 'p'])
  assert.deepEqual(
    rankBillboard(live).map((item) => item.id),
    ['p', 's-early', 's-late', 'e1'],
  )
  assert.equal(tierPriceLabel('prime'), '$49')
  assert.equal(tierPriceLabel('nope'), '')
})

test('the homepage grid pads to 10 claim slots and does not invent a ladder', () => {
  const ranked = rankBillboard([
    row({ id: 'a', tier: 'prime', paidAt: 1 }),
    row({ id: 'b', tier: 'entry', paidAt: 2 }),
  ])
  const cells = padBillboard(ranked, 10)
  assert.equal(cells.length, 10)
  assert.equal(cells[0]?.kind, 'live')
  assert.equal(cells[1]?.kind, 'live')
  assert.equal(cells[2]?.kind, 'empty')
  assert.equal(cells[9]?.rank, 10)
  assert.equal(padBillboard(ranked, 1).length, 1)

  const source = readFileSync(join(here, '../content/billboard.ts'), 'utf8')
  for (const banned of ['$27', '$26', '$25', '$10', '$7', '$6', '$5']) {
    assert.equal(source.includes(banned), false, banned)
  }
})

test('an invoice request cannot publish itself or name a checkout', () => {
  const draft = billboardInvoiceDraft({
    tier: 'standard',
    url: 'https://example.com/product',
    email: 'Buyer@Example.com',
    name: 'Example',
  })
  assert.equal(draft?.status, 'requested')
  assert.equal(draft?.paidAt, null)
  assert.equal(draft?.published, false)
  assert.equal(draft?.email, 'buyer@example.com')
  assert.equal(billboardInvoiceDraft({ tier: 'boost', url: 'https://example.com', email: 'a@b.co' }), null)
  assert.equal(
    billboardInvoiceDraft({ tier: 'entry', url: 'javascript:alert(1)', email: 'a@b.co' }),
    null,
  )

  const invoice = readFileSync(join(here, '../../server/api/billboard/invoice.post.ts'), 'utf8')
  const checkout = readFileSync(join(here, '../../server/api/payments/ad-checkout.post.ts'), 'utf8')
  const home = readFileSync(join(here, '../../app/pages/index.vue'), 'utf8')
  const page = readFileSync(join(here, '../../app/pages/billboard.vue'), 'utf8')
  assert.equal(/checkout|ad-checkout|payment/i.test(invoice), false)
  assert.ok(checkout.indexOf('board_retired') < checkout.indexOf('getPaymentProvider(event)'))
  assert.match(checkout, /board_retired/)
  assert.match(home, /useBillboard\(/)
  assert.match(page, /useBillboard\(/)
  assert.match(page, /\/api\/billboard\/checkout/)
  assert.equal(page.includes('索取发票'), false)
  assert.equal(page.includes('Request invoice'), false)
  assert.equal(page.includes('/api/payments/'), false)
  assert.equal(home.includes('$27'), false)
})
