import test from 'node:test'
import assert from 'node:assert/strict'
import { withoutTrailingSlash } from './trailing-slash.ts'

test('a trailing slash is stripped and the root is left alone', () => {
  assert.equal(withoutTrailingSlash('/products/'), '/products')
  assert.equal(withoutTrailingSlash('/zh/products/claude/'), '/zh/products/claude')
  assert.equal(withoutTrailingSlash('/products//'), '/products')
  assert.equal(withoutTrailingSlash('/zh/'), '/zh')
})

test('a clean path is not redirected to itself', () => {
  // `null`, not the same string: a caller that gets the path back would answer
  // every request with a 301 to where it already is.
  assert.equal(withoutTrailingSlash('/products'), null)
  assert.equal(withoutTrailingSlash('/'), null)
  assert.equal(withoutTrailingSlash('/zh'), null)
  assert.equal(withoutTrailingSlash('/spotlights/peachchat'), null)
})
