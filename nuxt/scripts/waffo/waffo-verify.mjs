/**
 * Read every dirtool charge product and compare its stored USD price to the
 * page. Creating a checkout session is not a check: the session response does
 * not include the amount.
 *
 *   node scripts/waffo/waffo-verify.mjs
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WaffoPancake } from '@waffo/pancake-ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const NUXT = join(HERE, '../..')
const STORE = 'STO_6MBLArB4FXmrUHHjkyXxoV'

function loadCatalogue() {
  const res = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--input-type=module',
    '-e',
    `import { waffoChargeProducts } from './shared/payments/waffo-amount.ts'; process.stdout.write(JSON.stringify(waffoChargeProducts()))`,
  ], { cwd: NUXT, encoding: 'utf8' })
  if (res.status !== 0) throw new Error(res.stderr || 'could not load catalogue')
  return JSON.parse(res.stdout)
}

function loadIds() {
  const source = readFileSync(join(NUXT, 'shared/payments/waffo-product-ids.ts'), 'utf8')
  const match = source.match(/WAFFO_PRODUCT_IDS: Record<string, string> = (\{[\s\S]*\})/)
  if (!match) return {}
  return JSON.parse(match[1])
}

const client = new WaffoPancake({
  merchantId: process.env.WAFFO_MERCHANT_ID || 'MER_4wGnd956hsqBbRs2EZPx5b',
  privateKey: readFileSync(process.env.WAFFO_KEY_PATH || '/Users/mac/waffo-prod.pem', 'utf8'),
})

const catalogue = loadCatalogue()
const ids = loadIds()
const listed = await client.graphql.query({
  query: `query { onetimeProducts(storeId: "${STORE}", limit: 100) { id name status prices { currency priceInfo { amount } } } }`,
})
const products = listed.data?.onetimeProducts ?? []

let failed = 0
for (const entry of catalogue) {
  const id = ids[entry.key]
  const product = products.find((row) => row.id === id)
  const amount = product?.prices?.find((price) => price.currency === 'USD')?.priceInfo?.amount
  const ok = Boolean(id) && amount === entry.amount
  if (!ok) failed += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${entry.key.padEnd(16)} page $${entry.amount}  stored $${amount ?? '?'}  ${id ?? 'no product id'}`)
}

const orders = await client.graphql.query({
  query: `query { onetimeOrders(storeId: "${STORE}", limit: 8) { id status currency priceSnapshot { subtotal taxAmount total } createdAt } }`,
})
console.log('\nrecent orders (subtotal is the goods price, total includes tax):')
for (const order of orders.data?.onetimeOrders ?? []) {
  const snap = order.priceSnapshot
  console.log(`  ${order.id}  ${order.status}  subtotal ${snap?.subtotal ?? '?'}  tax ${snap?.taxAmount ?? '?'}  total ${snap?.total ?? '?'}  ${order.createdAt ?? ''}`)
}

console.log(`\n${catalogue.length - failed} matched, ${failed} failed`)
process.exit(failed ? 1 : 0)
