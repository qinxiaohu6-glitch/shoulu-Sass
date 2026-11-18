/**
 * One-time setup of the Waffo catalogue for dirtool.com.
 *
 * The account had a single product — "Featured Directory Listing (30 days)" at
 * $39 — while the site sells six SKUs. That name is wrong twice over (Featured
 * is a 7-day pin, and $39 is now the *regular* price, not the charged one), and
 * a one-product account makes the dashboard unable to tell a Boost from a Pro.
 *
 * This script creates one product per SKU at the REGULAR price. The campaign
 * price is never written into Waffo: checkout sends `priceSnapshot` from
 * `effectiveAmountCents()`, so the charge follows `CAMPAIGN.endsAt` and reverts
 * to the regular price here automatically. Writing the sale price into the
 * product instead would leave the account charging $4.99 after the clock ends.
 *
 * The existing product is reused as the Featured SKU (rename + metadata) so the
 * already-deployed `NUXT_WAFFO_PRODUCT_ID` keeps resolving to a real product.
 *
 *   node waffo-products.mjs          # dry run, prints the plan
 *   node waffo-products.mjs --apply  # creates/renames
 */
import { readFileSync } from 'node:fs'
import { WaffoPancake } from '@waffo/pancake-ts'

const MERCHANT = process.env.WAFFO_MERCHANT_ID || 'MER_4wGnd956hsqBbRs2EZPx5b'
const STORE = 'STO_6MBLArB4FXmrUHHjkyXxoV'
const LEGACY_FEATURED = 'PROD_5HQOX0laZm15SKWQTSgYEB'
const APPLY = process.argv.includes('--apply')

const client = new WaffoPancake({
  merchantId: MERCHANT,
  privateKey: readFileSync(process.env.WAFFO_KEY_PATH || '/Users/mac/waffo-prod.pem', 'utf8'),
})

const SALE_ENDS = '2026-12-01T06:59:00+08:00'

/** Regular price only. `sale` is metadata for humans, never the Waffo price. */
const CATALOGUE = [
  {
    sku: 'boost',
    name: 'Product Atlas — Boost',
    description:
      'Verified gold badge and a highlighted row on the weekly board, plus a permanent dofollow link. One-time.',
    regular: '10.00',
    sale: '4.99',
  },
  {
    sku: 'standard',
    name: 'Product Atlas — Standard listing',
    description: 'Listing published as soon as payment succeeds, with a permanent dofollow link. One-time.',
    regular: '19.00',
    sale: '9.00',
  },
  {
    sku: 'featured',
    name: 'Product Atlas — Featured listing (7-day pin)',
    description:
      'Everything in Standard, plus a 7-day pin on the directory and category pages and a homepage card. One-time.',
    regular: '39.00',
    sale: '19.00',
    reuse: LEGACY_FEATURED,
  },
  {
    sku: 'pro',
    name: 'Product Atlas — Pro listing (90-day pin)',
    description:
      'Everything in Featured, with a 90-day category pin and four copy edits a year. One-time.',
    regular: '69.00',
    sale: '29.00',
  },
  {
    sku: 'billboard',
    name: 'Product Atlas — Billboard placement',
    description:
      'Name-your-price placement in the Billboard Top 10. The amount charged is the bid, from $10. One-time.',
    regular: '10.00',
    sale: '10.00',
  },
  {
    sku: 'ad',
    name: 'Product Atlas — Sidebar ad (1 week)',
    description:
      'Card in the right rail of the homepage and the just-added feed for seven days, starting Monday.',
    regular: '19.00',
    sale: '9.00',
  },
]

function meta(entry) {
  return {
    sku: entry.sku,
    site: 'https://dirtool.com',
    regular_amount: entry.regular,
    campaign_amount: entry.sale,
    campaign_ends_at: SALE_ENDS,
    note: 'Campaign price is sent by checkout as priceSnapshot; this product always holds the regular price.',
  }
}

async function existing() {
  const res = await client.graphql.query({
    query: `query { onetimeProducts(storeId: "${STORE}", limit: 50) { id name status prices { currency priceInfo { amount } } } }`,
  })
  return res.data?.onetimeProducts ?? []
}

const before = await existing()
console.log('existing products:')
for (const p of before) console.log(`  ${p.id}  ${p.status}  ${p.prices?.[0]?.priceInfo?.amount ?? '?'}  ${p.name}`)

if (!APPLY) {
  console.log('\nplan (dry run):')
  for (const entry of CATALOGUE) {
    const hit = before.find((p) => p.name === entry.name) || (entry.reuse ? before.find((p) => p.id === entry.reuse) : null)
    console.log(
      `  ${hit ? 'reuse ' : 'create'}  ${entry.sku.padEnd(10)} $${entry.regular}  (campaign $${entry.sale})  ${entry.name}`,
    )
  }
  console.log('\nre-run with --apply to write')
  process.exit(0)
}

const created = {}

for (const entry of CATALOGUE) {
  const reuse = entry.reuse ? before.find((p) => p.id === entry.reuse) : null
  if (reuse) {
    const { product } = await client.onetimeProducts.update({
      id: reuse.id,
      name: entry.name,
      description: entry.description,
      prices: { USD: { amount: entry.regular, taxCategory: 'digital_goods' } },
      metadata: meta(entry),
    })
    created[entry.sku] = product.id
    console.log(`updated ${product.id} → ${entry.name} (${product.status})`)
    continue
  }
  const { product } = await client.onetimeProducts.create({
    storeId: STORE,
    name: entry.name,
    description: entry.description,
    prices: { USD: { amount: entry.regular, taxCategory: 'digital_goods' } },
    metadata: meta(entry),
  })
  created[entry.sku] = product.id
  console.log(`created ${product.id} → ${entry.name} (${product.status})`)
}

console.log('\nNUXT_WAFFO_PRODUCT_IDS =', JSON.stringify(created))
console.log('\nverify:')
for (const p of await existing()) {
  console.log(`  ${p.id}  ${p.status}  ${p.prices?.[0]?.priceInfo?.amount ?? '?'}  ${p.name}`)
}
