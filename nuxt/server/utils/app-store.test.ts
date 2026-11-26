import assert from 'node:assert/strict'
import test from 'node:test'
import { AppStoreError, cleanAppStores, parseAppStoreUrl } from './app-store.ts'
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
