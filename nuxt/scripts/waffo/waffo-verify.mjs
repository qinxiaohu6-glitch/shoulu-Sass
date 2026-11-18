/**
 * Proves every SKU can open a checkout at the amount the site would charge.
 *
 * Each call creates a real hosted session (no charge, no email — anonymous) and
 * sends the campaign amount through `priceSnapshot`, which is exactly what
 * `server/utils/payments/waffo.ts` does. If a product id or a price were wrong,
 * Waffo would answer with an error here instead of at a customer's checkout.
 *
 *   node waffo-verify.mjs
 */
import { readFileSync } from 'node:fs'
import { WaffoPancake } from '@waffo/pancake-ts'

const client = new WaffoPancake({
  merchantId: process.env.WAFFO_MERCHANT_ID || 'MER_4wGnd956hsqBbRs2EZPx5b',
  privateKey: readFileSync(process.env.WAFFO_KEY_PATH || '/Users/mac/waffo-prod.pem', 'utf8'),
})

const IDS = {
  boost: 'PROD_4eD1iGfl1bqdhaGul01hor',
  standard: 'PROD_421o8REQUoFO0L0PlvWhXx',
  featured: 'PROD_5HQOX0laZm15SKWQTSgYEB',
  pro: 'PROD_6RYnnSdwxk4IRXMEkETtqd',
  billboard: 'PROD_76I8otMCarp0AiIoKtdYLf',
  ad: 'PROD_44caej1VRQG0QqYBWuvrBh',
}

/** Charged now (campaign open) and after CAMPAIGN.endsAt — from pricing.ts. */
const CASES = [
  { sku: 'boost', now: '4.99', after: '10.00' },
  { sku: 'standard', now: '9.00', after: '19.00' },
  { sku: 'featured', now: '19.00', after: '39.00' },
  { sku: 'pro', now: '29.00', after: '69.00' },
  { sku: 'billboard', now: '10.00', after: '10.00' },
  { sku: 'ad', now: '9.00', after: '19.00' },
]

let pass = 0
let fail = 0

for (const item of CASES) {
  for (const [phase, amount] of [
    ['campaign', item.now],
    ['regular', item.after],
  ]) {
    try {
      const session = await client.checkout.createSession({
        productId: IDS[item.sku],
        currency: 'USD',
        priceSnapshot: { amount, taxCategory: 'digital_goods' },
        successUrl: 'https://dirtool.com/payment/success',
        orderMerchantExternalId: `probe-${item.sku}-${phase}-${Date.now()}`,
        metadata: { probe: 'true', sku: item.sku, phase },
      })
      console.log(`ok   ${item.sku.padEnd(10)} ${phase.padEnd(9)} $${amount}  ${session.sessionId}`)
      pass += 1
    } catch (err) {
      console.log(`FAIL ${item.sku.padEnd(10)} ${phase.padEnd(9)} $${amount}  ${err.message}`)
      fail += 1
    }
  }
}

console.log(`\n${pass} ok, ${fail} failed`)
process.exit(fail ? 1 : 0)
