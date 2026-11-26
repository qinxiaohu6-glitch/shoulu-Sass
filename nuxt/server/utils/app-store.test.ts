import assert from 'node:assert/strict'
import test from 'node:test'
import { AppStoreError, cleanAppStores, googleScreenshots, lookupAppStore, parseAppStoreUrl } from './app-store.ts'
import { SUBMIT_ERRORS } from './http.ts'

const appStore = (platform: 'ios' | 'android' | 'macos', url: string, appId: string) => ({
  platform,
  appId,
  storeUrl: url,
  name: 'Sample App',
  developer: 'Sample Developer',
  description: 'A public store description.',
  icon: 'https://cdn.example.com/icon.png',
  screenshots: ['https://cdn.example.com/screen-1.png', 'javascript:alert(1)'],
  category: 'Productivity',
  genres: ['Productivity'],
  version: '1.2.3',
  updatedAt: '',
  releasedAt: '',
  priceLabel: 'Free',
  rating: 5.8,
  ratingCount: -2,
  size: '',
  minimumOsVersion: '',
  ageRating: '',
})

test('parseAppStoreUrl recognizes iOS, Mac App Store and Google Play', () => {
  assert.deepEqual(
    parseAppStoreUrl('https://apps.apple.com/us/app/sample/id123456789'),
    {
      platform: 'ios',
      appId: '123456789',
      storeUrl: 'https://apps.apple.com/us/app/id123456789',
      country: 'us',
    },
  )
  assert.equal(
    parseAppStoreUrl('https://apps.apple.com/us/mac/app/sample/id987654321').platform,
    'macos',
  )
  assert.equal(
    parseAppStoreUrl('https://play.google.com/store/apps/details?id=com.example.sample').appId,
    'com.example.sample',
  )
})

test('parseAppStoreUrl rejects non-store hosts and platform mismatches', () => {
  assert.throws(() => parseAppStoreUrl('https://apps.apple.com.evil.example/us/app/id123'), AppStoreError)
  assert.throws(() => parseAppStoreUrl('http://apps.apple.com/us/app/id123'), AppStoreError)
  assert.throws(() => parseAppStoreUrl('https://play.google.com/store/apps/details?id=com.example.app', 'ios'), AppStoreError)
})

test('cleanAppStores revalidates URLs, limits ratings and removes unsafe images', () => {
  const cleaned = cleanAppStores([
    appStore('ios', 'https://apps.apple.com/us/app/id123456789', '123456789'),
  ])
  assert.equal(cleaned[0]?.name, 'Sample App')
  assert.equal(cleaned[0]?.rating, null)
  assert.equal(cleaned[0]?.ratingCount, null)
  assert.deepEqual(cleaned[0]?.screenshots, ['https://cdn.example.com/screen-1.png'])
})

test('cleanAppStores rejects duplicate platforms and forged application IDs', () => {
  const first = appStore('ios', 'https://apps.apple.com/us/app/id123456789', '123456789')
  assert.throws(() => cleanAppStores([first, first]), (error: unknown) =>
    error instanceof AppStoreError && error.code === 'duplicate_app_platform',
  )
  assert.throws(() => cleanAppStores([
    appStore('ios', 'https://apps.apple.com/us/app/id123456789', '999999999'),
  ]), (error: unknown) => error instanceof AppStoreError && error.code === 'invalid_app_store_data')
})

test('APP and tag validation errors return client errors instead of internal errors', () => {
  for (const code of [
    'tags_required',
    'video_tag_required',
    'bad_listing_type',
    'app_store_required',
    'invalid_store_url',
    'invalid_platform',
    'platform_mismatch',
    'unsupported_store_url',
    'invalid_app_store_data',
    'duplicate_app_platform',
    'app_store_data_too_large',
  ]) {
    assert.equal(SUBMIT_ERRORS[code]?.status, 400, `${code} should be a 400 response`)
  }
  assert.equal(SUBMIT_ERRORS.duplicate_app?.status, 409)
  assert.equal(SUBMIT_ERRORS.duplicate_app?.en, 'That app has already been submitted and is in the queue.')
})

test('Google Play screenshots come from the list strip, not the icon or avatars', () => {
  const icon = 'https://play-lh.googleusercontent.com/ICONHASH0000000000000000=w240-h480'
  const html = [
    `<img src="${icon}" alt="Icon image">`,
    '<div role="listitem"><div><img src="https://play-lh.googleusercontent.com/SHOTONE0000000000000000=w526-h296" alt="Screenshot image"></div></div>',
    '<div role="listitem"><img src="https://play-lh.googleusercontent.com/SHOTTWO0000000000000000=w296-h526" alt="Screenshot image"></div>',
    '<div role="listitem"><img src="https://play-lh.googleusercontent.com/AVATAR00000000000000000=s20"></div>',
  ].join('')
  assert.deepEqual(googleScreenshots(html, icon), [
    'https://play-lh.googleusercontent.com/SHOTONE0000000000000000=w720',
    'https://play-lh.googleusercontent.com/SHOTTWO0000000000000000=w720',
  ])
})

test('Google Play screenshots fall back to the localised alt text', () => {
  const html = '<img alt="屏幕截图图片" src="https://play-lh.googleusercontent.com/SHOTZH00000000000000000=w526-h296">'
  assert.deepEqual(googleScreenshots(html, ''), [
    'https://play-lh.googleusercontent.com/SHOTZH00000000000000000=w720',
  ])
})

test('a transient store failure is retried once', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    if (calls === 1) throw new TypeError('network reset')
    return new Response(
      JSON.stringify({ resultCount: 1, results: [{ trackId: 123, trackName: 'Retry App' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }) as typeof fetch
  try {
    const info = await lookupAppStore('https://apps.apple.com/us/app/retry/id123')
    assert.equal(info.name, 'Retry App')
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = original
  }
})
