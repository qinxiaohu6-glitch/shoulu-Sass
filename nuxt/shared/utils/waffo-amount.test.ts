import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  catalogueAmount,
  classifyCharge,
  sessionQuote,
  productKey,
  productLockedToAmount,
  selectProductId,
  waffoChargeProducts,
} from '../payments/waffo-amount.ts'

const here = dirname(fileURLToPath(import.meta.url))

test('each charge has its own product key and the page amount', () => {
  const products = waffoChargeProducts()
  const keys = products.map((entry) => entry.key)
  assert.equal(new Set(keys).size, keys.length)
  assert.equal(new Set(products.map((entry) => entry.name)).size, products.length)
  assert.equal(products.some((entry) => entry.amountCents <= 0), false)
  assert.equal(products.some((entry) => entry.plan === 'billboard'), false)

  const byKey = Object.fromEntries(products.map((entry) => [entry.key, entry.amount]))
  assert.equal(byKey['boost:499'], '4.99')
  assert.equal(byKey['boost:1000'], '10.00')
  assert.equal(byKey['ad:900'], '9.00')
  assert.equal(byKey['ad:3200'], '32.00')
  assert.equal(byKey['ad:1900'], '19.00')
  assert.equal(byKey['ad:7600'], '76.00')
  assert.equal(byKey['ad:2900'], '29.00')
  assert.equal(byKey['ad:11600'], '116.00')
  assert.equal(productKey('boost', 499), 'boost:499')
})

test('checkout picks the product minted for that amount', () => {
  const ids = {
    boost: 'PROD_LEGACY_BOOST',
    'boost:499': 'PROD_BOOST_499',
    ad: 'PROD_LEGACY_AD',
    'ad:2900': 'PROD_BOARD_2900',
  }
  assert.equal(selectProductId(ids, 'boost', 499), 'PROD_BOOST_499')
  assert.equal(selectProductId(ids, 'boost', 1000), 'PROD_LEGACY_BOOST')
  assert.equal(selectProductId(ids, 'ad', 2900), 'PROD_BOARD_2900')
  assert.equal(selectProductId(ids, 'ad', 3200, 'PROD_FALLBACK'), 'PROD_LEGACY_AD')
  assert.equal(productLockedToAmount(ids, 'PROD_BOOST_499', 499), true)
  assert.equal(productLockedToAmount(ids, 'PROD_BOOST_499', 1000), false)
  assert.equal(productLockedToAmount(ids, 'PROD_LEGACY_AD', 900), false)
  assert.equal(productLockedToAmount({ ad: 'PROD_LEGACY_AD', 'ad:900': 'PROD_LEGACY_AD' }, 'PROD_LEGACY_AD', 900), false)
  assert.equal(productLockedToAmount(ids, 'PROD_UNKNOWN', 499), false)
})

test('a catalogue price that is not the page price is not tax', () => {
  assert.deepEqual(
    classifyCharge({ orderCents: 499, chargedCents: 1000, currency: 'usd', orderCurrency: 'usd', goodsCents: null }),
    { ok: false, reason: 'excess' },
  )
  assert.deepEqual(
    classifyCharge({ orderCents: 900, chargedCents: 1900, currency: 'usd', orderCurrency: 'usd', goodsCents: null }),
    { ok: false, reason: 'excess' },
  )
  assert.deepEqual(
    classifyCharge({ orderCents: 3200, chargedCents: 1900, currency: 'usd', orderCurrency: 'usd', goodsCents: null }),
    { ok: false, reason: 'shortfall' },
  )
  assert.deepEqual(
    classifyCharge({ orderCents: 2900, chargedCents: 1900, currency: 'usd', orderCurrency: 'usd', goodsCents: null }),
    { ok: false, reason: 'shortfall' },
  )
  assert.deepEqual(
    classifyCharge({ orderCents: 11600, chargedCents: 1900, currency: 'usd', orderCurrency: 'usd', goodsCents: null }),
    { ok: false, reason: 'shortfall' },
  )
  assert.equal(
    classifyCharge({ orderCents: 499, chargedCents: 549, currency: 'usd', orderCurrency: 'usd', goodsCents: 499 }).ok,
    true,
  )
  assert.deepEqual(
    classifyCharge({ orderCents: 499, chargedCents: 499, currency: 'usd', orderCurrency: 'usd', goodsCents: 499 }),
    { ok: true },
  )
  assert.deepEqual(
    classifyCharge({ orderCents: 499, chargedCents: 1000, currency: 'usd', orderCurrency: 'usd', goodsCents: 1000 }),
    { ok: false, reason: 'goods_mismatch' },
  )
  assert.deepEqual(
    classifyCharge({ orderCents: 499, chargedCents: 1000, currency: 'usd', orderCurrency: 'usd', goodsCents: 499 }),
    { ok: false, reason: 'excess' },
  )
  assert.deepEqual(
    classifyCharge({ orderCents: 499, chargedCents: 499, currency: 'eur', orderCurrency: 'usd', goodsCents: 499 }),
    { ok: false, reason: 'currency' },
  )
})

test('the hosted checkout payload is the locked price', () => {
  assert.deepEqual(
    sessionQuote({
      sessionResult: { data: { checkoutSession: { productId: 'PROD_x', priceInfo: { amount: '4.99' } } } },
    }),
    { amount: '4.99', productId: 'PROD_x' },
  )
  assert.deepEqual(sessionQuote({}), { amount: null, productId: null })
})

test('product prices are read from both API shapes', () => {
  assert.equal(catalogueAmount([{ currency: 'USD', priceInfo: { amount: '4.99' } }]), '4.99')
  assert.equal(catalogueAmount({ USD: { amount: '29.00' } }), '29.00')
  assert.equal(catalogueAmount({ EUR: { amount: '9.00' } }), null)
})

test('checkout refuses a session when the stored price differs, and the webhook does not treat that as tax', () => {
  const waffo = readFileSync(join(here, '../../server/utils/payments/waffo.ts'), 'utf8')
  const webhook = readFileSync(join(here, '../../server/api/payments/webhook.post.ts'), 'utf8')
  const listing = readFileSync(join(here, '../../server/api/payments/checkout.post.ts'), 'utf8')
  const ad = readFileSync(join(here, '../../server/api/payments/ad-checkout.post.ts'), 'utf8')
  const script = readFileSync(join(here, '../../scripts/waffo/waffo-products.mjs'), 'utf8')

  assert.match(waffo, /bad_amount/)
  assert.match(waffo, /allowPromotionCodes: false/)
  assert.match(waffo, /\/api\/checkout\/bootstrap/)
  assert.match(waffo, /onetimeProducts\.update/)
  assert.ok(waffo.indexOf("'bad_amount'") < waffo.lastIndexOf('createSession'))
  assert.match(webhook, /classifyCharge/)
  assert.equal(webhook.includes('tax/overpayment'), false)
  assert.match(listing, /amount_mismatch/)
  assert.match(ad, /amount_mismatch/)
  assert.match(script, /LEGACY_IDS/)
  assert.equal(script.includes('this product always holds the regular price'), false)
  assert.match(script, /waffoChargeProducts/)
})
