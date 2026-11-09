import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { decideBillboardFulfilment, isPublicBillboard } from './billboard-fulfilment.ts'

const here = dirname(fileURLToPath(import.meta.url))

test('payment makes one pending row live, and a repeat does not create another', () => {
  const pending = { id: 'bb_1', status: 'pending', paidAt: null }
  const first = decideBillboardFulfilment(pending)
  assert.deepEqual(first, { ok: true, id: 'bb_1', duplicate: false })
  const again = decideBillboardFulfilment({ id: 'bb_1', status: 'live', paidAt: 100 })
  assert.deepEqual(again, { ok: true, id: 'bb_1', duplicate: true })
  assert.equal(isPublicBillboard(pending), false)
  assert.equal(isPublicBillboard({ status: 'live', paidAt: 100 }), true)
  assert.equal(isPublicBillboard({ status: 'requested', paidAt: null }), false)
  assert.equal(isPublicBillboard({ status: 'removed', paidAt: 100 }), false)
})

test('a missing or removed placement is not published', () => {
  assert.deepEqual(decideBillboardFulfilment(null), { ok: false, reason: 'missing' })
  assert.deepEqual(decideBillboardFulfilment({ id: 'bb_x', status: 'removed', paidAt: 5 }), {
    ok: false,
    reason: 'removed',
  })
})

test('the webhook branches to billboard before the empty-submission ad path', () => {
  const source = readFileSync(join(here, '../../server/api/payments/webhook.post.ts'), 'utf8')
  const billboard = source.indexOf("settled.plan === 'billboard'")
  const ad = source.indexOf("settled.plan === 'ad'")
  assert.ok(billboard > 0)
  assert.ok(ad > billboard)
  assert.match(source, /activateBillboardPlacement/)
})
