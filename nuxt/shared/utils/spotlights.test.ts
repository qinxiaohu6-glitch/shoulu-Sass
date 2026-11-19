/**
 * Spotlight entitlement, slug rules, and the copy that promises them.
 *
 * The storage layer has its own database test (`server/utils/spotlights-db.test.ts`);
 * this file only covers the shared half — the part both the browser and the
 * server import, where a mistake shows up as a pricing page that sells
 * something the site does not deliver.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SPOTLIGHT_MAX,
  SPOTLIGHT_MAX_WORDS,
  SPOTLIGHT_MIN_WORDS,
  SPOTLIGHT_PLANS,
  isReservedSpotlightSlug,
  isSpotlightSlug,
  planIncludesSpotlight,
  spotlightSlug,
  spotlightWords,
} from '../content/spotlights.ts'
import { comparison, tiers } from '../content/pricing.ts'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path: string) => readFileSync(join(here, path), 'utf8')

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

test('the published standard and the enforced gate are the same two numbers', () => {
  assert.equal(SPOTLIGHT_MIN_WORDS, 800)
  assert.equal(SPOTLIGHT_MAX_WORDS, 1500)
  // The guidelines page quotes the bounds in prose. A gate that moves without
  // the copy moving is a writer failing a rule they were never told about.
  const guidelines = read('../../app/pages/spotlights/guidelines.vue')
  assert.match(guidelines, /800/, 'guidelines do not mention the 800-word floor')
  assert.match(guidelines, /1,500|1500/, 'guidelines do not mention the 1,500-word ceiling')
  // The error copy in the shared table quotes them too.
  const errors = read('../../server/utils/http.ts')
  assert.match(errors, /800/)
  assert.match(errors, /1,500/)
})

test('a generated slug is a safe URL segment', () => {
  assert.equal(spotlightSlug('Alpha'), 'alpha')
  assert.equal(spotlightSlug('Notion – AI'), 'notion-ai')
  assert.equal(spotlightSlug('Claude 3.5: Sonnet'), 'claude-3-5-sonnet')
  // Non-ASCII collapses rather than percent-escaping into a mangled link.
  assert.equal(spotlightSlug('  深度文章  '), 'spotlight')
  assert.equal(spotlightSlug(''), 'spotlight')
  assert.ok(spotlightSlug('x'.repeat(200)).length <= 60)
  for (const name of ['Alpha', 'Notion – AI', '  ', 'Ünïcode ✓ Name']) {
    assert.equal(isSpotlightSlug(spotlightSlug(name)), true, `${name} produced an invalid slug`)
  }
})

test('a slug cannot shadow a real route', () => {
  // Every static page under /spotlights/ has to be reserved, or a published
  // article could take its URL. Reading the directory means a new page added
  // later fails this test instead of quietly becoming shadowable.
  const pagesDir = join(here, '../../app/pages/spotlights')
  const staticPages = readdirSync(pagesDir)
    .filter((file) => file.endsWith('.vue') && file !== 'index.vue' && !file.startsWith('['))
    .map((file) => file.slice(0, -4))
  assert.ok(staticPages.length >= 3, 'expected guidelines, badge and submit to exist')
  for (const page of staticPages) {
    assert.equal(isReservedSpotlightSlug(page), true, `${page} is a real page but is not reserved`)
  }
  assert.equal(isReservedSpotlightSlug('alpha'), false)
  // Uppercase, leading hyphens and path separators are not slugs.
  for (const bad of ['Alpha', '-alpha', 'alpha/beta', 'alpha beta', '']) {
    assert.equal(isSpotlightSlug(bad), false, `${bad} was accepted as a slug`)
  }
})

test('the field ceilings are big enough for the article and nothing else', () => {
  // 1,500 words at a generous 8 characters per word still fits the body column.
  assert.ok(SPOTLIGHT_MAX.body > SPOTLIGHT_MAX_WORDS * 8)
  assert.ok(SPOTLIGHT_MAX.tagline <= 160, 'a tagline longer than 160 breaks the meta description')
  assert.ok(SPOTLIGHT_MAX.productName >= 44, 'product names are already capped at 44 elsewhere')
})

test('both forms render the same field component', () => {
  // The customer form and the console write the same article. If either grew
  // its own inputs, the two would describe the article differently within a
  // month — and the published standard on /spotlights/guidelines describes one
  // set of fields, not two.
  for (const page of [
    '../../app/pages/spotlights/submit.vue',
    '../../app/pages/admin/spotlights/new.vue',
  ]) {
    assert.match(read(page), /<SpotlightDraftFields/, `${page} has its own field markup`)
  }

  const fields = read('../../app/components/SpotlightDraftFields.vue')
  for (const id of [
    'sd-listing',
    'sd-name',
    'sd-url',
    'sd-tagline',
    'sd-body',
    'sd-bestfor',
    'sd-pricing',
    'sd-author',
    'sd-email',
    'sd-bio',
  ]) {
    assert.ok(fields.includes(`id="${id}"`), `the shared form lost #${id}`)
  }
  // Both callers are told the same bounds, from the same constants.
  assert.match(fields, /SPOTLIGHT_MIN_WORDS/)
  assert.match(fields, /SPOTLIGHT_MAX_WORDS/)

  // The public form keeps the one rule the console may relax.
  const submit = read('../../app/pages/spotlights/submit.vue')
  assert.match(submit, /email-required/)
  assert.match(submit, /\/api\/spotlights\/submit/)
  // And the console posts to its own, owner-gated endpoint.
  const admin = read('../../app/pages/admin/spotlights/new.vue')
  assert.match(admin, /\/api\/admin\/spotlights\/create/)
  assert.match(admin, /email-required="false"|:email-required="false"/)
})
