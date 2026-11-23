import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { BILLBOARD_TIERS } from '../content/billboard.ts'
import { centsLabel } from '../content/campaign.ts'
import { adPlans, adPriceCents, listingBenefits, tiers } from '../content/pricing.ts'
import {
  categoryBrowseModel,
  emptyCategoryLinks,
  homeOfferSlots,
  offerSpotLine,
  type BrowseTool,
  type OfferListing,
} from './home-offers.ts'
import { effectiveQuote } from './pricing-effective.ts'

const here = dirname(fileURLToPath(import.meta.url))
const read = (rel: string) => readFileSync(join(here, rel), 'utf8')

function tool(partial: Partial<BrowseTool> & Pick<BrowseTool, 'slug' | 'category'>): BrowseTool {
  return { logo: '', votes_week: 0, ...partial }
}

test('category thumbs use real logos and do not pad to four', () => {
  const catalog = [
    tool({ slug: 'a', category: 'writing', logo: 'assets/img/icons/a.png', votes_week: 3 }),
    tool({ slug: 'b', category: 'writing', logo: '', votes_week: 1 }),
    tool({ slug: 'c', category: 'image', logo: 'assets/img/icons/c.png', votes_week: 9 }),
  ]
  const submitted = [
    tool({ slug: 'community', category: 'writing', logo: 'https://cdn.example/logo.png', votes_week: 2 }),
  ]
  const card = categoryBrowseModel('writing', catalog, submitted)
  assert.equal(card.empty, false)
  assert.equal(card.count, 3)
  assert.equal(card.votes, 6)
  assert.equal(card.showVoteBar, true)
  assert.deepEqual(
    card.thumbs.map((thumb) => thumb.slug),
    ['a', 'community'],
  )
  assert.equal(card.thumbs.some((thumb) => thumb.logo.startsWith('https://')), true)
  assert.equal(card.thumbs.length < 4, true)
})

test('a category with no logos still does not invent thumbnail slots', () => {
  const card = categoryBrowseModel(
    'writing',
    [tool({ slug: 'bare', category: 'writing', logo: '  ', votes_week: 4 })],
    [],
  )
  assert.deepEqual(card.thumbs, [])
  assert.equal(card.count, 1)
  assert.equal(card.showVoteBar, true)
})

test('weekly votes of zero hide the bar, and an empty category recruits', () => {
  const quiet = categoryBrowseModel(
    'writing',
    [tool({ slug: 'a', category: 'writing', logo: 'assets/img/icons/a.png', votes_week: 0 })],
    [],
  )
  assert.equal(quiet.votes, 0)
  assert.equal(quiet.showVoteBar, false)
  assert.equal(quiet.empty, false)

  const empty = categoryBrowseModel('writing', [], [])
  assert.equal(empty.empty, true)
  assert.equal(empty.count, 0)
  assert.deepEqual(empty.thumbs, [])
  assert.equal(empty.showVoteBar, false)
  assert.deepEqual(emptyCategoryLinks('writing'), {
    list: { path: '/submit', query: { category: 'writing' } },
    sponsor: { path: '/pricing' },
  })
})

test('hidden tools and duplicate slugs are not counted twice', () => {
  const catalog = [
    tool({ slug: 'same', category: 'writing', logo: '', votes_week: 5 }),
    tool({ slug: 'gone', category: 'writing', logo: 'assets/img/icons/gone.png', votes_week: 8 }),
  ]
  const submitted = [
    tool({ slug: 'same', category: 'writing', logo: 'https://cdn.example/same.png', votes_week: 5 }),
  ]
  const card = categoryBrowseModel('writing', catalog, submitted, ['gone'])
  assert.equal(card.count, 1)
  assert.equal(card.votes, 5)
  assert.deepEqual(card.thumbs, [{ slug: 'same', logo: 'https://cdn.example/same.png' }])
})

test('thumbnails stop at four real logos', () => {
  const catalog = ['a', 'b', 'c', 'd', 'e'].map((slug) =>
    tool({ slug, category: 'writing', logo: `assets/img/icons/${slug}.png` }),
  )
  const card = categoryBrowseModel('writing', catalog, [])
  assert.deepEqual(
    card.thumbs.map((thumb) => thumb.slug),
    ['a', 'b', 'c', 'd'],
  )
  assert.equal(card.count, 5)
})

test('offer slots quote the price checkout charges, not a second price list', () => {
  const slots = homeOfferSlots({ listings: [], billboard: null, sidebar: null })
  assert.deepEqual(
    slots.map((slot) => slot.id),
    ['board', 'sidebar'],
  )
  assert.equal(slots[0]?.price, '$29')
  assert.equal(slots[1]?.price, '$9')
  // The sidebar price is the charged amount, so it tracks the campaign clock.
  // The launch-board ad is a flat weekly price and is not discounted.
  assert.equal(slots[0]?.price, centsLabel(adPriceCents('board', 1)))
  assert.equal(slots[1]?.price, effectiveQuote('sidebar', '1').priceLabel)
  assert.equal(slots.every((slot) => slot.occupant === null), true)
  assert.deepEqual(slots[0]?.href, { path: '/book-ad', query: { slot: 'board', weeks: '1' } })
  assert.deepEqual(slots[1]?.href, { path: '/book-ad', query: { slot: 'sidebar', weeks: '1' } })
  assert.equal(slots[0]?.flag, 'BOARD')
  assert.equal(slots[1]?.flag, 'SIDEBAR')
  assert.equal(offerSpotLine(slots[0]!, 'zh'), '发布榜广告 $29/周')
  assert.equal(offerSpotLine(slots[0]!, 'en'), 'Launch board ad $29/week')
  assert.equal(offerSpotLine(slots[1]!, 'zh'), '右栏广告 $9/周')
  assert.equal(offerSpotLine(slots[1]!, 'en'), 'Right sidebar ad $9/week')
  assert.equal(slots.some((slot) => /spots left|\d+\/\d+/.test(offerSpotLine(slot, 'en'))), false)
  assert.equal(slots.some((slot) => /周租|\/week board|Board slot/.test(`${slot.name.en} ${slot.detail.en}`)), false)
})

test('catalogue seed and unpaid intent do not fill a spot; a paid order does', () => {
  const seed: OfferListing = {
    slug: 'chatgpt',
    name: 'ChatGPT',
    short: 'seed',
    logo: 'assets/img/icons/chatgpt.png',
    is_paid: true,
  }
  const unpaid: OfferListing = {
    slug: 'intent',
    name: 'Intent',
    short: 'not paid',
    logo: 'https://cdn.example/intent.png',
    is_paid: false,
    plan: 'featured',
  }
  const standard: OfferListing = {
    slug: 'std',
    name: 'Standard Co',
    short: 'standard',
    logo: 'https://cdn.example/std.png',
    is_paid: true,
    plan: 'standard',
  }
  const featured: OfferListing = {
    slug: 'real-featured',
    name: 'Real Featured',
    short: 'paid featured',
    logo: 'https://cdn.example/featured.png',
    is_paid: true,
    plan: 'featured',
  }
  const pro: OfferListing = {
    slug: 'real-pro',
    name: 'Real Pro',
    short: 'paid pro',
    logo: 'https://cdn.example/pro.png',
    is_paid: true,
    plan: 'pro',
  }
  const slots = homeOfferSlots({
    listings: [seed, unpaid, standard, featured, pro],
    billboard: {
      name: 'Board Co',
      headline: 'On the billboard',
      logo: 'https://cdn.example/board.png',
      url: 'https://board.example',
    },
    sidebar: null,
  })
  const byId = Object.fromEntries(slots.map((slot) => [slot.id, slot.occupant]))
  assert.equal(byId.board?.name, 'Board Co')
  assert.equal(byId.board?.external, true)
  assert.equal(byId.board?.href, 'https://board.example')
  assert.equal(byId.sidebar, null)
  assert.equal(
    slots.some((slot) => slot.occupant?.name === 'ChatGPT' || slot.occupant?.name === 'Standard Co'),
    false,
  )
})

test('the homepage no longer hosts the four benefit cards, and pricing does', () => {
  const home = read('../../app/pages/index.vue')
  const pricing = read('../../app/pages/pricing.vue')
  assert.equal(home.includes('收录后你能得到什么'), false)
  assert.equal(home.includes('cat-card__mix-empty'), false)
  assert.equal(home.includes('这些位置可以订'), false)
  assert.equal(home.includes('交付的就是这三件事'), false)
  assert.equal(home.includes('按分类浏览'), false)
  assert.equal(home.includes('最新收录'), false)
  assert.equal(home.includes('Your product here'), true)
  assert.equal(home.includes('Just launched'), true)
  assert.equal(home.includes('Schedule opens soon'), false)
  assert.equal(home.includes('Submit your software product.'), true)
  assert.equal(home.includes('Get a permanent directory page.'), true)
  assert.equal(home.includes('Get found, not buried.'), false)
  // Original, SEO-aware copy — never the competitor's verbatim headline.
  assert.equal(home.includes('Launch this week.'), false)
  assert.equal(home.includes('Get real users.'), false)
  assert.equal(home.includes('Launch for free'), false)
  assert.equal(home.includes('spots left'), false)
  // The homepage now carries real advertising slots (ProductsBoost-style rail).
  assert.equal(home.includes('Your ad here'), true)
  assert.equal(home.includes('rail-ad'), true)
  assert.equal(home.includes('boostQuote'), true)
  assert.equal(home.includes('成为该分类第一个'), false)
  assert.equal(home.includes('赞助这个分类'), false)
  // The pricing page now follows the competitor shell; the old benefit grid
  // was removed rather than repeated under the new FAQ.
  assert.equal(pricing.includes('收录后你能得到什么'), false)
  assert.equal(pricing.includes('每个选项显示在哪里'), true)
  assert.deepEqual(
    listingBenefits.map((item) => item.title.zh),
    ['付费即得 dofollow 反链', 'AI 搜索读得懂', '每周一次冲榜机会', '先粘贴网址'],
  )
  assert.deepEqual(
    tiers.map((tier) => `${tier.id}:${tier.price}`),
    ['free:$0', 'boost:$10', 'standard:$19', 'featured:$39', 'pro:$69'],
  )
  assert.deepEqual(
    adPlans.map((plan) => `${plan.id}:${plan.price}`),
    ['board:$29', 'sidebar:$19'],
  )
  assert.deepEqual(
    BILLBOARD_TIERS.map((tier) => `${tier.id}:${tier.price}`),
    ['entry:$15', 'standard:$29', 'prime:$49'],
  )
})
