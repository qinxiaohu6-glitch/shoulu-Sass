/**
 * Create one Waffo product per amount dirtool can charge.
 *
 * The stored price IS the charge. Checkout also sends `priceSnapshot` with
 * the same number, then reads the stored price back and refuses to open a
 * session when they differ. A campaign price and the regular price are two
 * products, so the clock expiring does not depend on editing a live product
 * between two buyers.
 *
 * Legacy "Product Atlas" products are left alone. The site that is live today
 * still charges through those ids. This script only creates or reprices a
 * product whose name starts with "dirtool —".
 *
 *   node scripts/waffo/waffo-products.mjs          # dry run
 *   node scripts/waffo/waffo-products.mjs --apply  # create / reprice dirtool products
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WaffoPancake } from '@waffo/pancake-ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const NUXT = join(HERE, '../..')
const IDS_FILE = join(NUXT, 'shared/payments/waffo-product-ids.ts')

const MERCHANT = process.env.WAFFO_MERCHANT_ID || 'MER_4wGnd956hsqBbRs2EZPx5b'
const STORE = 'STO_6MBLArB4FXmrUHHjkyXxoV'
const APPLY = process.argv.includes('--apply')

/** Products the current production site still uses. Never reprice these. */
const LEGACY_IDS = new Set([
  'PROD_4eD1iGfl1bqdhaGul01hor',
  'PROD_421o8REQUoFO0L0PlvWhXx',
  'PROD_5HQOX0laZm15SKWQTSgYEB',
  'PROD_6RYnnSdwxk4IRXMEkETtqd',
  'PROD_76I8otMCarp0AiIoKtdYLf',
  'PROD_44caej1VRQG0QqYBWuvrBh',
])

function loadCatalogue() {
  const res = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--input-type=module',
    '-e',
    `import { waffoChargeProducts } from './shared/payments/waffo-amount.ts'; process.stdout.write(JSON.stringify(waffoChargeProducts()))`,
  ], { cwd: NUXT, encoding: 'utf8' })
  if (res.status !== 0) {
    throw new Error(res.stderr || res.stdout || 'could not load waffoChargeProducts()')
  }
  return JSON.parse(res.stdout)
}

function usdOf(product) {
  const row = product.prices?.find((price) => price.currency === 'USD')
  return row?.priceInfo?.amount ?? null
}

const client = new WaffoPancake({
  merchantId: MERCHANT,
  privateKey: readFileSync(process.env.WAFFO_KEY_PATH || '/Users/mac/waffo-prod.pem', 'utf8'),
})

async function existing() {
  const res = await client.graphql.query({
    query: `query { onetimeProducts(storeId: "${STORE}", limit: 100) { id name status prices { currency priceInfo { amount } } } }`,
  })
  return res.data?.onetimeProducts ?? []
}

const catalogue = loadCatalogue()
const before = await existing()
console.log('existing products:')
for (const product of before) {
  console.log(`  ${product.id}  ${product.status}  ${usdOf(product) ?? '?'}  ${product.name}`)
}

console.log(APPLY ? '\napplying:' : '\nplan (dry run):')
const written = {}
let failed = 0

for (const entry of catalogue) {
  const named = before.find((product) => product.name === entry.name)
  if (named && LEGACY_IDS.has(named.id)) {
    console.log(`  REFUSE  ${entry.key}  name collides with legacy ${named.id}`)
    failed += 1
    continue
  }
  if (named) {
    const current = usdOf(named)
    if (current === entry.amount) {
      written[entry.key] = named.id
      console.log(`  keep    ${entry.key.padEnd(16)} $${entry.amount}  ${named.id}`)
      continue
    }
    if (!APPLY) {
      console.log(`  reprice ${entry.key.padEnd(16)} $${current ?? '?'} → $${entry.amount}  ${named.id}`)
      continue
    }
    const { product } = await client.onetimeProducts.update({
      id: named.id,
      name: entry.name,
      description: entry.description,
      prices: { USD: { amount: entry.amount, taxCategory: 'digital_goods' } },
      metadata: { sku: entry.key, site: 'https://dirtool.com', amount: entry.amount },
    })
    written[entry.key] = product.id
    console.log(`  updated ${entry.key.padEnd(16)} $${entry.amount}  ${product.id}`)
    continue
  }
  if (!APPLY) {
    console.log(`  create  ${entry.key.padEnd(16)} $${entry.amount}  ${entry.name}`)
    continue
  }
  const { product } = await client.onetimeProducts.create({
    storeId: STORE,
    name: entry.name,
    description: entry.description,
    prices: { USD: { amount: entry.amount, taxCategory: 'digital_goods' } },
    metadata: { sku: entry.key, site: 'https://dirtool.com', amount: entry.amount },
  })
  written[entry.key] = product.id
  console.log(`  created ${entry.key.padEnd(16)} $${entry.amount}  ${product.id}  ${product.status}`)
}

if (!APPLY) {
  console.log('\nre-run with --apply to write. Legacy product prices are not changed.')
  process.exit(failed ? 1 : 0)
}

console.log('\nread-back:')
const after = await existing()
for (const entry of catalogue) {
  const id = written[entry.key]
  const product = after.find((row) => row.id === id)
  const amount = product ? usdOf(product) : null
  const ok = amount === entry.amount && !LEGACY_IDS.has(id)
  if (!ok) failed += 1
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${entry.key.padEnd(16)} stored $${amount ?? '?'} expected $${entry.amount}  ${id ?? 'missing'}`)
}

if (failed) {
  console.error('\nrefusing to write product ids: a stored price does not match the page')
  process.exit(1)
}

const body = `/**
 * One Waffo product per charge. The value is the product whose stored USD
 * price equals that charge. Written by \`scripts/waffo/waffo-products.mjs --apply\`
 * after a read-back. The worker secret overrides a key when it sets the same key.
 *
 * These ids are not a secret. They do not replace the legacy plan keys the
 * current production site still uses (\`boost\`, \`ad\`, …).
 */
export const WAFFO_PRODUCT_IDS: Record<string, string> = ${JSON.stringify(written, null, 2)}
`
writeFileSync(IDS_FILE, body)
console.log(`\nwrote ${IDS_FILE}`)
console.log('NUXT_WAFFO_PRODUCT_IDS amount keys are in that file. Do not replace the legacy plan keys on the worker until the new checkout is deployed.')
