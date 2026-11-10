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

test('listing prices are the cold-start charges; Billboard tiers stay storage labels', () => {
  assert.deepEqual(
    tiers.map((tier) => `${tier.id}:${tier.price}:${tier.amountCents}`),
    ['free:$0:0', 'standard:$9:900', 'featured:$19:1900', 'pro:$29:2900'],
  )
  assert.deepEqual(
    BILLBOARD_TIERS.map((tier) => `${tier.id}:${tier.price}:${tier.amountCents}`),
    ['entry:$15:1500', 'standard:$29:2900', 'prime:$49:4900'],
  )
  assert.deepEqual(
    adPlans.map((plan) => `${plan.id}:${plan.price}:${plan.weeklyCents}:${plan.bundleCents}`),
    ['sidebar:$9:900:3200'],
  )
  assert.equal(billboardStandardCents(), 2900)
  assert.equal(planAmountCents('ad'), 2900)
  assert.equal(planAmountCents('standard'), 900)
  assert.equal(adPriceCents('sidebar', 1), 900)
  assert.equal(adPriceCents('sidebar', 4), 3200)
  assert.equal(adPriceCents('sidebar', 2), 0)
  assert.equal(adPriceCents('board', 1), 0)
  assert.equal(adPriceCents('board', 4), 0)
})

test('percent-off stays at zero and the countdown clock still ends', () => {
  const before = Date.parse('2026-12-01T06:58:59+08:00')
  const atEnd = Date.parse(BLACK_FRIDAY.endsAt)
  assert.equal(campaignDeadlineShanghai(), '2026-12-01 06:59')
  assert.equal(campaignActive(before), true)
  assert.equal(campaignActive(atEnd), false)
  assert.equal(campaignActive(before, false), false)
  assert.equal(BLACK_FRIDAY.off, 0)

  const standard = quoteCents(900, before)
  assert.equal(standard.priceLabel, '$9')
  assert.equal(standard.strikeLabel, null)
  assert.equal(quoteCents(1900, before).priceLabel, '$19')
  assert.equal(quoteCents(1900, before).strikeLabel, null)
  assert.equal(quoteCents(1500, before, 1500).priceLabel, '$15')
  assert.equal(quoteCents(1500, before, 1500).strikeLabel, null)
  assert.equal(saleCents(1900), 1900)
  assert.equal(saleCents(0), 0)
})

test('rank is total backed, earlier payment wins a tie, and the same URL stacks', () => {
  const rows = [
    row({ id: 'low', tier: 'entry', paidAt: 10, amountCents: 1500, url: 'https://low.example' }),
    row({ id: 'high-late', tier: 'entry', paidAt: 50, amountCents: 3100, url: 'https://late.example' }),
    row({ id: 'high-early', tier: 'standard', paidAt: 20, amountCents: 3100, url: 'https://early.example' }),
    row({ id: 'stack-a', tier: 'entry', paidAt: 5, amountCents: 1500, url: 'https://stack.example/a' }),
    row({ id: 'stack-b', tier: 'entry', paidAt: 40, amountCents: 2000, url: 'https://stack.example/a' }),
    row({ id: 'legacy', tier: 'prime', paidAt: 3, url: 'https://legacy.example' }),
    row({ id: 'wait', tier: 'prime', paidAt: 1, status: 'requested', amountCents: 9000 }),
    row({ id: 'removed', tier: 'prime', paidAt: 1, status: 'removed' }),
  ]
  const live = publicBillboardRows(rows)
  assert.equal(live.some((item) => item.id === 'wait' || item.id === 'removed'), false)
  const ranked = rankBillboard(live)
  assert.deepEqual(
    ranked.map((item) => item.id),
    ['legacy', 'stack-a', 'high-early', 'high-late', 'low'],
  )
  assert.equal(ranked[0]?.amountCents, 4900)
  assert.equal(ranked[1]?.amountCents, 3500)
  assert.equal(ranked[1]?.paidAt, 5)
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
  assert.match(page, /Request invoice/)
  assert.match(page, /索取发票/)
  assert.match(page, /\/api\/billboard\/invoice/)
  assert.match(page, /Name your price/)
  assert.equal(page.includes('/api/payments/'), false)
  assert.equal(page.includes('Stripe'), false)
  assert.equal(page.includes('AHREFS'), false)
  assert.equal(home.includes('$27'), false)
  for (const gone of ['交付的就是这三件事', '这些位置可以订', '按分类浏览', '最新收录']) {
    assert.equal(home.includes(gone), false, gone)
  }
  const layout = readFileSync(join(here, '../../app/layouts/default.vue'), 'utf8')
  assert.equal(layout.includes('免费目录页会留下来'), false)
  assert.match(layout, /BlackFridayBar/)
})
