import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SPOTLIGHTS,
  SPOTLIGHT_PLANS,
  planIncludesSpotlight,
  publishedSpotlights,
  spotlightBySlug,
  spotlightWords,
} from '../content/spotlights.ts'
import { comparison, tiers } from '../content/pricing.ts'

test('only the plans that pay for a spotlight report one', () => {
  assert.equal(planIncludesSpotlight('featured'), true)
  assert.equal(planIncludesSpotlight('pro'), true)
  assert.equal(planIncludesSpotlight('free'), false)
  assert.equal(planIncludesSpotlight('boost'), false)
  assert.equal(planIncludesSpotlight('standard'), false)
  assert.equal(planIncludesSpotlight(''), false)
  assert.equal(planIncludesSpotlight(null), false)
  assert.equal(planIncludesSpotlight(undefined), false)
})

test('a tier cannot grant a spotlight it does not advertise', () => {
  // The entitlement list and the copy that promises it are the same promise to
  // a buyer. If one changes without the other, this fails.
  for (const plan of SPOTLIGHT_PLANS) {
    const tier = tiers.find((item) => item.id === plan)
    assert.ok(tier, `no tier for ${plan}`)
    assert.equal(
      tier.features.en.some((line) => /spotlight/i.test(line)),
      true,
      `${plan} does not list a spotlight in English`,
    )
    assert.equal(
      tier.features.zh.some((line) => /spotlight/i.test(line)),
      true,
      `${plan} does not list a spotlight in Chinese`,
    )
  }
  // And no other tier may claim it.
  for (const tier of tiers) {
    if ((SPOTLIGHT_PLANS as readonly string[]).includes(tier.id)) continue
    assert.equal(
      tier.features.en.some((line) => /spotlight/i.test(line)),
      false,
      `${tier.id} claims a spotlight it does not grant`,
    )
  }
})

test('the comparison table has a spotlight row on the right columns', () => {
  const row = comparison.find((item) => /spotlight/i.test(item.label.en))
  assert.ok(row, 'no spotlight row in the comparison table')
  // Values are positional: free, boost, standard, featured, pro.
  assert.equal(row.values.length, tiers.length)
  tiers.forEach((tier, index) => {
    const included = row.values[index]!.en !== '—'
    assert.equal(
      included,
      (SPOTLIGHT_PLANS as readonly string[]).includes(tier.id),
      `comparison row disagrees with the entitlement for ${tier.id}`,
    )
  })
})

test('spotlight word counting ignores padding', () => {
  assert.equal(spotlightWords(''), 0)
  assert.equal(spotlightWords('   '), 0)
  assert.equal(spotlightWords('one two  three\n four '), 4)
})

test('every published spotlight is addressable and long enough to be worth one', () => {
  const slugs = new Set<string>()
  for (const item of SPOTLIGHTS) {
    assert.equal(slugs.has(item.slug), false, `duplicate slug ${item.slug}`)
    slugs.add(item.slug)
    assert.match(item.slug, /^[a-z0-9-]+$/)
    assert.ok(item.productName.length > 1)
    assert.ok(item.listingSlug.length > 1, `${item.slug} has no listing to link to`)
    assert.ok(item.productUrl.startsWith('https://'), `${item.slug} product URL is not https`)
    assert.match(item.publishedAt, /^\d{4}-\d{2}-\d{2}$/)
    // The guidelines promise 800–1,500 words; a published article that breaks
    // that promise is a broken promise, not a style issue.
    const words = spotlightWords(item.body)
    assert.ok(words >= 800 && words <= 1500, `${item.slug} is ${words} words`)
    assert.equal(spotlightBySlug(item.slug)?.slug, item.slug)
  }
})

test('the index lists newest first without mutating the registry', () => {
  const order = publishedSpotlights()
  assert.equal(order.length, SPOTLIGHTS.length)
  for (let i = 1; i < order.length; i++) {
    assert.ok(order[i - 1]!.publishedAt >= order[i]!.publishedAt)
  }
  assert.deepEqual(
    SPOTLIGHTS.map((item) => item.slug),
    [...SPOTLIGHTS].map((item) => item.slug),
  )
})
