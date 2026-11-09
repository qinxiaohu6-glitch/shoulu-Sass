import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isReservedProductSlug, productRedirect } from './product-routes.ts'

test('old product URLs move to /products and the DR page stays', () => {
  assert.equal(productRedirect('/tools/claude'), '/products/claude')
  assert.equal(productRedirect('/tools/claude.html'), '/products/claude')
  assert.equal(productRedirect('/zh/tools/claude'), '/zh/products/claude')
  assert.equal(productRedirect('/zh/tools/claude.html'), '/zh/products/claude')
  assert.equal(productRedirect('/tools'), null)
  assert.equal(productRedirect('/tools/dr-checker'), null)
  assert.equal(productRedirect('/zh/tools/dr-checker'), null)
  assert.equal(productRedirect('/products/claude'), null)
  assert.equal(isReservedProductSlug('DR-Checker'), true)
  assert.equal(isReservedProductSlug('claude'), false)
})
