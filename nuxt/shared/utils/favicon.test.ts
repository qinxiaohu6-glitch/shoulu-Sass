import test from 'node:test'
import assert from 'node:assert/strict'
import { faviconCacheKey, faviconSourcesFor, isFetchableHost, sniffImageType } from './favicon.ts'

/* -------------------------------------------------------------------------
   which hosts may be fetched
   ------------------------------------------------------------------------- */

test('a plain public hostname is fetchable', () => {
  assert.equal(isFetchableHost('talkmiochat.com'), true)
  assert.equal(isFetchableHost('a.b.co.uk'), true)
  assert.equal(isFetchableHost('my-product.io'), true)
})

test('anything that is not a public hostname is refused', () => {
  // The host comes from a URL the buyer typed, and we then fetch it — so the
  // shape check is the only thing standing between this route and a request
  // aimed at the network it runs in.
  for (const bad of [
    '',
    'localhost',
    '127.0.0.1',
    '10.0.0.1',
    '192.168.1.1',
    'example',
    'foo.local',
    'foo.internal',
    'foo.arpa',
    'foo.test',
    'foo.invalid',
    'https://talkmiochat.com',
    'talkmiochat.com:8080',
    'talkmiochat.com/path',
    'talkmiochat.com.',
    '-lead.com',
    'trail-.com',
  ]) {
    assert.equal(isFetchableHost(bad), false, `${bad} must be refused`)
  }
})

test('a host is normalised before it is judged', () => {
  assert.equal(isFetchableHost('  TalkMioChat.COM  '), true)
})

/* -------------------------------------------------------------------------
   are the bytes an image
   ------------------------------------------------------------------------- */

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ico = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x01, 0x00])
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])

function webp(): Uint8Array {
  const bytes = new Uint8Array(16)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8)
  return bytes
}

test('a real image is identified by its bytes', () => {
  assert.equal(sniffImageType(png), 'image/png')
  assert.equal(sniffImageType(ico), 'image/x-icon')
  assert.equal(sniffImageType(jpeg), 'image/jpeg')
  assert.equal(sniffImageType(gif), 'image/gif')
  assert.equal(sniffImageType(webp()), 'image/webp')
})

test('an error page dressed as an icon is not accepted', () => {
  // A missing favicon very often arrives as HTTP 200 with an HTML body, so the
  // declared content type cannot be trusted on its own.
  const html = new TextEncoder().encode('<!DOCTYPE html><html><body>404</body></html>')
  assert.equal(sniffImageType(html), '')
  assert.equal(sniffImageType(new Uint8Array(0)), '')
})

test('RIFF alone is not enough — a WAV is not an icon', () => {
  const wav = new Uint8Array(16)
  wav.set([0x52, 0x49, 0x46, 0x46], 0)
  wav.set([0x57, 0x41, 0x56, 0x45], 8)
  assert.equal(sniffImageType(wav), '')
})

/* -------------------------------------------------------------------------
   sources and cache key
   ------------------------------------------------------------------------- */

test('the site itself is the fallback when the favicon service has nothing', () => {
  const sources = faviconSourcesFor('talkmiochat.com')
  assert.equal(sources.length, 2)
  assert.match(sources[1]!, /^https:\/\/talkmiochat\.com\/favicon\.ico$/)
  // The domain is encoded, never interpolated raw, so a crafted host cannot
  // add query parameters to the third-party URL.
  assert.match(sources[0]!, /domain=talkmiochat\.com&sz=128$/)
})

test('the cache key is stable per host and different across hosts', async () => {
  const a = await faviconCacheKey('talkmiochat.com')
  const b = await faviconCacheKey('talkmiochat.com')
  const c = await faviconCacheKey('other.com')
  assert.equal(a, b)
  assert.notEqual(a, c)
  // It has to be a legal asset id, because that is the table it lands in.
  assert.match(a, /^[0-9a-f]{32}\.png$/)
})
