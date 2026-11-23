import test from 'node:test'
import assert from 'node:assert/strict'
import { breadcrumbSchema, faqPageSchema, itemListSchema, siteEntitySchema, SCHEMA_SITE } from './schema.ts'
import { LAUNCH_PLATFORMS, launchPlatform } from '../content/launch-platforms.ts'

test('FAQ markup carries the answer text, which the closed accordion does not', () => {
  const schema = faqPageSchema([
    { question: 'Is it free?', answer: 'Yes, with a review.' },
    { question: '   ', answer: 'no question, dropped' },
    { question: 'Empty answer', answer: '  ' },
  ])
  assert.equal(schema['@type'], 'FAQPage')
  assert.equal(schema.mainEntity.length, 1)
  assert.equal(schema.mainEntity[0]!.name, 'Is it free?')
  assert.equal(schema.mainEntity[0]!.acceptedAnswer.text, 'Yes, with a review.')
})

test('breadcrumbs are absolute and numbered from one', () => {
  const schema = breadcrumbSchema([
    { name: 'Discover', path: '/' },
    { name: 'Launch platforms', path: '/alternatives' },
  ])
  assert.equal(schema.itemListElement.length, 2)
  assert.equal(schema.itemListElement[0]!.position, 1)
  assert.equal(schema.itemListElement[0]!.item, `${SCHEMA_SITE}/`)
  assert.equal(schema.itemListElement[1]!.item, `${SCHEMA_SITE}/alternatives`)
})

test('an item list keeps the order it is given and counts itself', () => {
  const schema = itemListSchema('This week', [
    { name: 'First', path: '/products/first' },
    { name: 'Second', path: '/products/second', position: 5 },
  ])
  assert.equal(schema.numberOfItems, 2)
  assert.equal(schema.itemListElement[0]!.position, 1)
  assert.equal(schema.itemListElement[1]!.position, 5)
  assert.equal(schema.itemListElement[1]!.url, `${SCHEMA_SITE}/products/second`)
})

test('the site entity links its Organization and WebSite by @id', () => {
  const schema = siteEntitySchema({
    name: 'dirtool',
    url: 'https://dirtool.com/',
    logo: 'https://dirtool.com/assets/img/brand/logo.png',
    sameAs: ['https://x.com/example'],
    email: 'hello@example.com',
  })
  const [org, site] = schema['@graph'] as Array<Record<string, unknown>>
  assert.equal(org!['@type'], 'Organization')
  assert.equal(site!['@type'], 'WebSite')
  // The site name Google prints above a result comes from here, not from og:site_name.
  assert.equal(site!.name, 'dirtool')
  assert.equal(site!.url, 'https://dirtool.com/')
  assert.deepEqual(site!.publisher, { '@id': org!['@id'] })
  assert.equal((org!.logo as Record<string, unknown>).url, 'https://dirtool.com/assets/img/brand/logo.png')
  assert.deepEqual(org!.sameAs, ['https://x.com/example'])
  assert.equal(org!.email, 'hello@example.com')
  // Nothing invented: no address, no founding date, no company type.
  for (const key of ['address', 'foundingDate', 'legalName', 'vatID']) {
    assert.equal(key in org!, false)
  }
})

test('a site entity without contact details omits them instead of blanking them', () => {
  const schema = siteEntitySchema({ name: 'X', url: 'https://x.test/', logo: 'https://x.test/l.png' })
  const [org] = schema['@graph'] as Array<Record<string, unknown>>
  assert.equal('sameAs' in org!, false)
  assert.equal('email' in org!, false)
})

test('every platform has a unique slug, both languages and no price claim', () => {
  const slugs = new Set<string>()
  for (const platform of LAUNCH_PLATFORMS) {
    assert.equal(slugs.has(platform.slug), false, `duplicate slug ${platform.slug}`)
    slugs.add(platform.slug)
    assert.match(platform.slug, /^[a-z0-9-]+$/)
    assert.ok(platform.name.length > 1)
    assert.ok(platform.rhythm.en.length > 4 && platform.rhythm.zh.length > 2)
    assert.ok(platform.best.en.length > 4 && platform.best.zh.length > 2)
    assert.ok(platform.note.en.length > 20 && platform.note.zh.length > 10)
    // No dollar amount anywhere: another platform's price changes without
    // notice, so the page must not state one.
    assert.equal(/\$\s?\d/.test(platform.note.en), false, platform.slug)
    assert.equal(/[$¥]\s?\d/.test(platform.best.en), false, platform.slug)
  }
  assert.equal(slugs.size, 8)
})

test('the slug lookup is exact and a miss is a miss', () => {
  assert.equal(launchPlatform('devhunt')?.name, 'DevHunt')
  assert.equal(launchPlatform('DevHunt'), undefined)
  assert.equal(launchPlatform(''), undefined)
})
