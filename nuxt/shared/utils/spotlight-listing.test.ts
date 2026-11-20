import test from 'node:test'
import assert from 'node:assert/strict'
import { findSpotlightListing, hostOf } from './spotlight-listing.ts'

const listings = [
  { slug: 'peachchat', url: 'https://peachchat.live' },
  { slug: 'vibcall', url: 'https://www.vibcall.com/' },
]

test('the slug wins when it still resolves', () => {
  assert.equal(
    findSpotlightListing('peachchat', 'https://peachchat.live', listings)?.slug,
    'peachchat',
  )
})

test('a stale slug still finds the product by its host', () => {
  // The exact case that took a published article down: the listing was deleted
  // and re-added, so `listing_slug` pointed at a slug that no longer exists.
  const moved = findSpotlightListing(
    'peachchat-private-1v1-video-call-with-verified-g',
    'https://peachchat.live',
    listings,
  )
  assert.equal(moved?.slug, 'peachchat')
})

test('www and the trailing slash do not matter', () => {
  assert.equal(findSpotlightListing('gone', 'https://vibcall.com', listings)?.slug, 'vibcall')
  assert.equal(findSpotlightListing('gone', 'vibcall.com', listings)?.slug, 'vibcall')
})

test('a product that really left the directory resolves to nothing', () => {
  assert.equal(findSpotlightListing('gone', 'https://example.com', listings), null)
  assert.equal(findSpotlightListing('', '', listings), null)
})

test('the slug is only trusted for an exact match', () => {
  // A prefix or a case-folded match would let one article borrow another's card.
  assert.equal(findSpotlightListing('peach', 'https://example.com', listings), null)
  assert.equal(findSpotlightListing('PeachChat', 'https://example.com', listings), null)
})

test('hostOf normalises the shapes a submitter actually types', () => {
  assert.equal(hostOf('https://peachchat.live'), 'peachchat.live')
  assert.equal(hostOf('http://www.peachchat.live/path?q=1'), 'peachchat.live')
  assert.equal(hostOf('peachchat.live'), 'peachchat.live')
  assert.equal(hostOf('  HTTPS://PeachChat.LIVE  '), 'peachchat.live')
  assert.equal(hostOf(''), '')
  assert.equal(hostOf('not a url'), '')
})
