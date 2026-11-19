/**
 * The `/alternatives` cluster may name a competitor and may not link to one.
 *
 * This is the regression guard for a mistake that was already made once: the
 * first build of these pages carried an "Official site ↗" anchor on every
 * sub-page, which handed the visitor straight to the platform the page was
 * comparing against. The rule is not a style preference — a comparison page
 * that sends the reader away is paying to advertise a competitor.
 *
 * The assertion is deliberately blunt: these three files contain **no absolute
 * URL at all**. A weaker check ("no href to devhunt.org") would pass the moment
 * a platform is added, and a check against a list of domains would need
 * maintaining. Zero `http(s)://` cannot drift.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAUNCH_PLATFORMS, launchPlatform } from '../content/launch-platforms.ts'

const here = dirname(fileURLToPath(import.meta.url))
const read = (path: string) => readFileSync(join(here, path), 'utf8')

const CLUSTER = [
  '../content/launch-platforms.ts',
  '../../app/pages/alternatives/index.vue',
  '../../app/pages/alternatives/[platform].vue',
]

test('nothing in the alternatives cluster points at another site', () => {
  for (const file of CLUSTER) {
    const source = read(file)
    assert.equal(
      /https?:\/\//.test(source),
      false,
      `${file} contains an absolute URL — a competitor link on a comparison page is free advertising for them`,
    )
    assert.equal(/target="_blank"/.test(source), false, `${file} opens something in a new tab`)
    // Protocol-relative links are an outbound link with the scheme left off.
    assert.equal(/href=["']\/\//.test(source), false, `${file} contains a protocol-relative link`)
  }
})

test('the platform list has no outbound url field to fill in by habit', () => {
  for (const platform of LAUNCH_PLATFORMS) {
    assert.equal(
      'url' in platform,
      false,
      `${platform.slug} carries a url — the field was removed on purpose, see the docblock`,
    )
    // The name is the point: a reader can look it up. That is all we give them.
    assert.ok(platform.name.length > 1)
  }
})

test('every platform is addressable, and the slugs are unique', () => {
  const slugs = new Set<string>()
  for (const platform of LAUNCH_PLATFORMS) {
    assert.match(platform.slug, /^[a-z0-9-]+$/, `${platform.slug} is not a URL segment`)
    assert.equal(slugs.has(platform.slug), false, `duplicate slug ${platform.slug}`)
    slugs.add(platform.slug)
    assert.equal(launchPlatform(platform.slug)?.slug, platform.slug)
    // Both languages, because the hub is bilingual even though the spokes are
    // English-only.
    assert.ok(platform.rhythm.en && platform.rhythm.zh, `${platform.slug} is missing rhythm copy`)
    assert.ok(platform.best.en && platform.best.zh, `${platform.slug} is missing best-for copy`)
    assert.ok(platform.note.en && platform.note.zh, `${platform.slug} is missing note copy`)
  }
  assert.equal(launchPlatform('not-a-platform'), undefined)
  assert.equal(LAUNCH_PLATFORMS.length, 8)
})

test('the hub links to its own sub-pages, not to the platforms', () => {
  const hub = read('../../app/pages/alternatives/index.vue')
  // The cards are internal routes built from the slug.
  assert.match(hub, /\/alternatives\/\$\{/)
  assert.equal(/<a\s[^>]*:href=/.test(hub), false, 'the hub renders an anchor with a bound href')
})

test('the sub-page dropped the "Official site" anchor', () => {
  const spoke = read('../../app/pages/alternatives/[platform].vue')
  assert.equal(/Official site/i.test(spoke), false)
  assert.equal(/official-site/.test(spoke), false)
})
