import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assetExtFor,
  assetUrl,
  isAssetId,
  MAX_STORED_BYTES,
  newAssetId,
} from './upload-asset.ts'

const HEX = '0123456789abcdef0123456789abcdef'

test('only raster formats are accepted, and the extension never comes from the file name', () => {
  assert.equal(assetExtFor('image/png'), 'png')
  assert.equal(assetExtFor('IMAGE/PNG'), 'png')
  assert.equal(assetExtFor('image/jpeg'), 'jpg')
  assert.equal(assetExtFor('image/svg+xml'), null, 'SVG can carry script')
  assert.equal(assetExtFor('text/html'), null)
  assert.equal(assetExtFor(''), null)
})

test('a minted id is exactly what the read route will serve', () => {
  const id = newAssetId('webp', () => HEX)
  assert.equal(id, `${HEX}.webp`)
  assert.ok(isAssetId(id))
})

test('an unknown extension throws instead of minting an unservable id', () => {
  // A silent 404 on an upload that reported success is worse than a 500 here.
  assert.throws(() => newAssetId('svg', () => HEX))
  assert.throws(() => newAssetId('', () => HEX))
})

test('the read route refuses anything that is not an asset id', () => {
  assert.ok(isAssetId(`${HEX}.png`))
  for (const bad of [
    '',
    '..%2f..%2fsession',
    '../../session',
    `${HEX}`,
    `${HEX}.svg`,
    `${HEX}.png/../x`,
    `${HEX.toUpperCase()}.png`,
    `${HEX}.png?x=1`,
    `a${HEX}.png`,
  ]) {
    assert.equal(isAssetId(bad), false, `must refuse: ${bad}`)
  }
})

test('the URL keeps the origin it was uploaded through', () => {
  assert.equal(assetUrl('https://dirtool.com', `${HEX}.png`), `https://dirtool.com/api/storage/file/${HEX}.png`)
  // A trailing slash must not become a double slash.
  assert.equal(assetUrl('https://dirtool.com/', `${HEX}.png`), `https://dirtool.com/api/storage/file/${HEX}.png`)
  assert.equal(assetUrl('http://127.0.0.1:4310', `${HEX}.png`), `http://127.0.0.1:4310/api/storage/file/${HEX}.png`)
})

test('the stored-bytes cap stays under what one base64 row can hold', () => {
  // D1 caps a single value at 2 MB; base64 inflates by ~4/3.
  assert.ok(MAX_STORED_BYTES * (4 / 3) < 2 * 1024 * 1024)
})
