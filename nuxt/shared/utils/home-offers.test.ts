import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { BILLBOARD_TIERS } from '../content/billboard.ts'
import { adPlans, listingBenefits, tiers } from '../content/pricing.ts'
import {
  categoryBrowseModel,
  emptyCategoryLinks,
  homeOfferSlots,
  offerSpotLine,
  type BrowseTool,
  type OfferListing,
} from './home-offers.ts'

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

test('offer slots keep the published prices and stay empty without a real order', () => {
  const slots = homeOfferSlots({ listings: [], billboard: null, sidebar: null })
  assert.deepEqual(
    slots.map((slot) => slot.id),
    ['featured', 'pro', 'billboard', 'sidebar'],
  )
  assert.equal(slots[0]?.price, '$39')
  assert.equal(slots[1]?.price, '$69')
  assert.equal(slots[2]?.price, '$29')
  assert.equal(slots[3]?.price, '$19')
  assert.equal(slots[0]?.price, tiers.find((tier) => tier.id === 'featured')?.price)
  assert.equal(slots[1]?.price, tiers.find((tier) => tier.id === 'pro')?.price)
  assert.equal(slots[2]?.price, BILLBOARD_TIERS.find((tier) => tier.id === 'standard')?.price)
  assert.equal(slots[3]?.price, adPlans.find((plan) => plan.id === 'sidebar')?.price)
  assert.equal(slots.every((slot) => slot.occupant === null), true)
  assert.deepEqual(slots[0]?.href, { path: '/submit', query: { plan: 'featured' } })
  assert.deepEqual(slots[1]?.href, { path: '/submit', query: { plan: 'pro' } })
  assert.deepEqual(slots[2]?.href, { path: '/billboard', hash: '#claim' })
  assert.deepEqual(slots[3]?.href, { path: '/book-ad', query: { slot: 'sidebar', weeks: '1' } })
  assert.equal(slots[0]?.flag, 'FEATURED')
  assert.equal(slots[2]?.flag, 'BILLBOARD')
  assert.equal(slots[0]?.detail.zh, '7 天置顶 + 首页卡')
  assert.equal(slots[1]?.detail.zh, '分类置顶 90 天')
  assert.equal(offerSpotLine(slots[0]!, 'zh'), '精选 $39 一次性')
  assert.equal(offerSpotLine(slots[0]!, 'en'), 'Featured $39 one-time')
  assert.equal(offerSpotLine(slots[1]!, 'zh'), '专业 $69 一次性')
  assert.equal(offerSpotLine(slots[1]!, 'en'), 'Pro $69 one-time')
  assert.equal(offerSpotLine(slots[2]!, 'zh'), 'Billboard $29 一次性')
  assert.equal(offerSpotLine(slots[2]!, 'en'), 'Billboard $29 one-time')
  assert.equal(offerSpotLine(slots[3]!, 'zh'), '右栏位 $19/周')
  assert.equal(offerSpotLine(slots[3]!, 'en'), 'Sidebar slot $19/week')
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
  assert.equal(byId.featured?.name, 'Real Featured')
  assert.equal(byId.featured?.href, '/tools/real-featured')
  assert.equal(byId.featured?.external, false)
  assert.equal(byId.pro?.name, 'Real Pro')
  assert.equal(byId.billboard?.name, 'Board Co')
  assert.equal(byId.billboard?.external, true)
  assert.equal(byId.billboard?.href, 'https://board.example')
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
  assert.equal(home.includes('这些位置可以订'), true)
  const offers = home.slice(home.indexOf('id="home-offers"'), home.indexOf('id="browse-by-category"'))
  assert.equal(offers.includes('投放广告'), true)
  assert.equal(offers.includes('Advertise'), true)
  assert.equal(offers.includes('megaphone'), true)
  assert.equal(offers.includes('offer-card--open'), true)
  assert.equal(offers.includes('is-taken'), true)
  assert.equal(offers.includes('你的产品'), false)
  assert.equal(offers.includes('Your product'), false)
  assert.equal(offers.includes('spots left'), false)
  assert.equal(offers.includes('Your ad here'), false)
  assert.equal(home.includes('成为该分类第一个'), true)
  assert.equal(home.includes('赞助这个分类'), true)
  assert.equal(pricing.includes('收录后你能得到什么'), true)
  assert.deepEqual(
    listingBenefits.map((item) => item.title.zh),
    ['付费即得 dofollow 反链', 'AI 搜索读得懂', '每周一次冲榜机会', '30 秒完成提交'],
  )
  assert.deepEqual(
    tiers.map((tier) => `${tier.id}:${tier.price}`),
    ['free:$0', 'standard:$19', 'featured:$39', 'pro:$69'],
  )
  assert.deepEqual(
    adPlans.map((plan) => `${plan.id}:${plan.price}`),
    ['sidebar:$19'],
  )
  assert.deepEqual(
    BILLBOARD_TIERS.map((tier) => `${tier.id}:${tier.price}`),
    ['entry:$15', 'standard:$29', 'prime:$49'],
  )
})
