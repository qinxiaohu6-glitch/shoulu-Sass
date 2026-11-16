/**
 * Batch 3: community profiles, old maker URLs, and the blog outline.
 * The outline is not a published article. Prices and the campaign are untouched.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { BLOG_POST_SLUGS } from '../content/blog.ts'
import {
  BLOG_TEMPLATES,
  FIRST_ARTICLE,
  outlineDirectionLength,
} from '../content/blog-template.ts'
import {
  MAKER_AVATAR_MAX_BYTES,
  communityCountLine,
  earliestListingDate,
  liveDirectoryCounts,
  makerAvatarSrc,
  makerLegacyRedirect,
  makerLiveIntro,
  makerPublicProfile,
  makersDirectoryMeta,
  optionalXUrl,
  visibleBio,
} from './community.ts'

const here = dirname(fileURLToPath(import.meta.url))

function read(path: string): string {
  return readFileSync(join(here, path), 'utf8')
}

const COMMUNITY_META =
  'Meet the makers behind the products in the directory. Profiles first. This page has no public feed.'
const COMMUNITY_H1 = 'The people behind the listings'
const COMMUNITY_SUB =
  'Every maker with a live product gets a public profile. Browse the directory through the people who shipped it.'
const COMMUNITY_HELPER =
  'This page has no public feed, comments, or messaging wall. If you want to be listed, submit a product.'
const MAKERS_SUB = 'Profiles of the people and teams behind listings on Product Atlas.'
const MAKERS_EMPTY = 'No maker profiles yet. Submit a product to create one.'
const L2 =
  'Paid listings go live when payment succeeds. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy.'

test('old maker URLs move to /community in one hop', () => {
  assert.equal(makerLegacyRedirect('/makers'), '/community/makers')
  assert.equal(makerLegacyRedirect('/makers/'), '/community/makers')
  assert.equal(makerLegacyRedirect('/makers.html'), '/community/makers')
  assert.equal(makerLegacyRedirect('/makers/anthropic'), '/community/makers/anthropic')
  assert.equal(makerLegacyRedirect('/makers/anthropic.html'), '/community/makers/anthropic')
  assert.equal(makerLegacyRedirect('/zh/makers'), '/zh/community/makers')
  assert.equal(makerLegacyRedirect('/zh/makers/anthropic'), '/zh/community/makers/anthropic')
  assert.equal(makerLegacyRedirect('/zh/makers/anthropic.html'), '/zh/community/makers/anthropic')
  assert.equal(makerLegacyRedirect('/community'), null)
  assert.equal(makerLegacyRedirect('/community/makers'), null)
  assert.equal(makerLegacyRedirect('/community/makers/anthropic'), null)
  assert.equal(makerLegacyRedirect('/products/claude'), null)
  assert.equal(makerLegacyRedirect('/makers/../admin'), null)
})

test('live counts dedupe products and skip hidden rows', () => {
  const counts = liveDirectoryCounts(
    [
      { slug: 'a', makerSlug: 'anthropic' },
      { slug: 'a', makerSlug: 'anthropic' },
      { slug: 'b', makerSlug: 'anthropic' },
      { slug: 'c', makerSlug: '' },
      { slug: 'hidden', makerSlug: 'gone' },
    ],
    ['hidden'],
  )
  assert.deepEqual(counts, { makers: 1, products: 3 })
  assert.equal(communityCountLine(2, 3), '2 makers · 3 products')
  assert.equal(communityCountLine(1, 1), '1 maker · 1 product')
  assert.equal(
    makersDirectoryMeta(2, 3),
    '2 makers behind 3 products in the Product Atlas directory.',
  )
})

test('a profile intro pluralises, and empty bio, site and avatar stay hidden', () => {
  assert.equal(makerLiveIntro('Anthropic', 1), 'Anthropic has 1 live product on Product Atlas.')
  assert.equal(makerLiveIntro('Anthropic', 2), 'Anthropic has 2 live products on Product Atlas.')
  assert.equal(visibleBio(''), null)
  assert.equal(visibleBio('  N/A '), null)
  assert.equal(visibleBio('Builds coding tools.'), 'Builds coding tools.')
  assert.equal(earliestListingDate(['2026-11-02', '2026-10-01T00:00:00.000Z']), '2026-10-01')
  assert.equal(makerAvatarSrc(''), null)
  assert.equal(makerAvatarSrc('data:image/png;base64,aaaa'), null)
  assert.equal(makerAvatarSrc('https://cdn.example/a.png'), 'https://cdn.example/a.png')
  assert.equal(optionalXUrl('https://example.com'), null)
  assert.equal(optionalXUrl('https://twitter.com/productatlas'), 'https://x.com/productatlas')
  assert.equal(MAKER_AVATAR_MAX_BYTES, 512 * 1024)
  const empty = makerPublicProfile({ name: 'Anthropic', bio: 'N/A', siteUrl: '', xUrl: '', avatarUrl: '' })
  assert.equal(empty.bio, null)
  assert.equal(empty.avatarUrl, null)
  assert.equal(empty.siteUrl, null)
  assert.equal(empty.xUrl, null)
})

test('community pages use the approved English and do not open a feed', () => {
  const landing = read('../../app/pages/community/index.vue')
  const index = read('../../app/pages/community/makers/index.vue')
  const profile = read('../../app/pages/community/makers/[slug].vue')
  assert.equal(landing.includes('Community · Product Atlas'), true)
  assert.equal(landing.includes(COMMUNITY_META), true)
  assert.equal(landing.includes(COMMUNITY_H1), true)
  assert.equal(landing.includes(COMMUNITY_SUB), true)
  assert.equal(landing.includes('Browse makers'), true)
  assert.equal(landing.includes('Submit a product'), true)
  assert.equal(landing.includes(COMMUNITY_HELPER), true)
  assert.equal(landing.includes('You appear here only after one of your products is live.'), true)
  assert.equal(landing.includes('Spam and adult content are not listed.'), true)
  assert.equal(index.includes('Makers · Product Atlas'), true)
  assert.equal(index.includes(MAKERS_SUB), true)
  assert.equal(index.includes(MAKERS_EMPTY), true)
  assert.equal(profile.includes('View product'), true)
  assert.equal(profile.includes('Visit website'), true)
  assert.equal(profile.includes('Listed on'), true)
  assert.equal(profile.includes('makerLiveIntro'), true)
  assert.equal(profile.includes('First live listing'), true)
  assert.equal(profile.includes('joined community on'), false)
  for (const text of [landing, index, profile]) {
    assert.equal(text.includes('/feed'), false)
    assert.equal(text.includes('Following'), false)
    assert.equal(text.includes('Latest'), false)
    assert.equal(text.includes('Discord'), false)
    assert.equal(text.includes('110k'), false)
    assert.equal(text.includes('作者'), false)
  }
})

test('nav points Community and Makers at the new paths and says 创客', () => {
  const layout = read('../../app/layouts/default.vue')
  assert.equal(layout.includes("pick('社区', 'Community')"), true)
  assert.equal(layout.includes("to: '/community/makers'"), true)
  assert.equal(layout.includes("pick('创客', 'Makers')"), true)
  assert.equal(layout.includes("to: '/makers'"), false)
  assert.equal(layout.includes('作者'), false)
  assert.equal(layout.includes("pick('开发者', 'Makers')"), false)
  const product = read('../../app/pages/products/[slug].vue')
  assert.equal(product.includes('/community/makers/${tool.makerSlug}'), true)
})

test('301 is wired for /makers and the sitemap lists the new paths', () => {
  const legacy = read('../../server/middleware/01-legacy-urls.ts')
  const moved = read('../../server/middleware/03-maker-urls.ts')
  const oldIndex = read('../../app/pages/makers/index.vue')
  const sitemap = read('../../server/routes/sitemap.xml.ts')
  assert.equal(legacy.includes('makerLegacyRedirect'), true)
  assert.equal(moved.includes('makerLegacyRedirect'), true)
  assert.equal(moved.includes('301'), true)
  assert.equal(oldIndex.includes('redirectCode: 301'), true)
  assert.equal(sitemap.includes("path: '/community'"), true)
  assert.equal(sitemap.includes("path: '/community/makers'"), true)
  assert.equal(sitemap.includes('/community/makers/${maker.slug}'), true)
  assert.equal(sitemap.includes("path: '/makers'"), false)
})

test('the blog outline is a guide, not a long article and not a ShipAny post', () => {
  assert.equal(FIRST_ARTICLE.title, 'How to list a product on Product Atlas')
  assert.equal(FIRST_ARTICLE.status, 'outline')
  assert.equal(FIRST_ARTICLE.template, 'guide')
  assert.equal('body' in FIRST_ARTICLE, false)
  assert.equal(BLOG_TEMPLATES.map((template) => template.kind).join(','), 'guide,comparison,directory-note')
  const directions = FIRST_ARTICLE.sections.map((section) => section.direction_en).join('\n')
  assert.equal(directions.includes(L2), true)
  assert.equal(directions.includes('Free to list, or pay once to go live when payment succeeds.'), true)
  assert.equal(directions.includes('usually in 7–14 days'), false)
  assert.ok(outlineDirectionLength() < 1800, `outline is ${outlineDirectionLength()} chars`)
  assert.equal(BLOG_POST_SLUGS.length, 0)
  const templateFile = read('../content/blog-template.ts')
  const bodies = read('../../app/utils/blogBodies.ts')
  assert.equal(templateFile.includes('Flippa'), false)
  assert.equal(templateFile.includes('ShipAny'), false)
  assert.equal(bodies.includes('ShipAny'), false)
  assert.equal(bodies.includes('const BODIES: Record<string, Record<string, string>> = {}'), true)
  const blogPage = read('../../app/pages/blog/[slug].vue')
  assert.equal(blogPage.includes('long article not published'), true)
  assert.equal(blogPage.includes('noindex,follow'), true)
})
