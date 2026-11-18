/**
 * Batch 1 copy and submit-prefill checks. Prices and the campaign deadline
 * are asserted as unchanged.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { englishCount } from './english-count.ts'
import { listingDocumentTitle } from './listing-title.ts'

const here = dirname(fileURLToPath(import.meta.url))

function read(path: string): string {
  return readFileSync(join(here, path), 'utf8')
}

const L1 = 'Free to list, or pay once to go live when payment succeeds.'
const L2 =
  'Paid listings go live when payment succeeds. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy.'
const L2_ZH =
  '付费档在付款成功后自动发布。免费收录由人工审核。中位审核时间见统计页；忙碌时请按最多 7–14 天来预期。'
const MEDIAN = 'For free listings that have already been reviewed.'
const MEDIAN_ZH = '仅针对已审完的免费收录。'

test('L1 and L2 are the approved sentences on the home and pricing FAQ', () => {
  const home = read('../../app/pages/index.vue')
  const pricing = read('../../shared/content/pricing.ts')
  const pricingPage = read('../../app/pages/pricing.vue')
  assert.equal(home.includes(L1), true)
  assert.equal(home.includes(L2), true)
  assert.equal(home.includes(L2_ZH), true)
  assert.equal(pricing.includes(L2), true)
  assert.equal(pricing.includes(L2_ZH), true)
  assert.equal(pricingPage.includes('It goes live when payment succeeds.'), true)
  assert.equal(home.includes('usually 7–14 days'), false)
  assert.equal(home.includes('通常 7–14 天'), false)
  assert.equal(home.includes('若走发票'), false)
  assert.equal(pricing.includes('usually reviewed in 7–14 days'), false)
})

test('the stats median qualifier ships with the new FAQ', () => {
  const stats = read('../../app/pages/stats.vue')
  assert.equal(stats.includes(MEDIAN), true)
  assert.equal(stats.includes(MEDIAN_ZH), true)
})

test('listing checkout and the pay toast do not promise an email', () => {
  const checkout = read('../../server/api/payments/checkout.post.ts')
  const pay = read('../../app/composables/usePayment.ts')
  const sentence = 'Could not open the payment page — try again in a moment.'
  const sentenceZh = '暂时打不开付款页面，请稍后再试。'
  assert.equal(checkout.includes(sentence), true)
  assert.equal(checkout.includes(sentenceZh), true)
  assert.equal(pay.includes(sentence), true)
  assert.equal(pay.includes(sentenceZh), true)
  assert.equal(pay.includes("reason === 'unconfigured'"), true)
  for (const text of [checkout, pay]) {
    assert.equal(text.includes('we will email you how to pay'), false, text.slice(0, 40))
    assert.equal(text.includes('邮件告诉你付款方式'), false)
    assert.equal(text.includes('Request invoice'), false)
    assert.equal(text.includes('Invoice confirmed'), false)
    assert.equal(text.includes('索取发票'), false)
  }
})

test('an unconfigured Billboard claim does not promise an email or an invoice', () => {
  const page = read('../../app/pages/billboard.vue')
  const checkout = read('../../server/api/billboard/checkout.post.ts')
  const sentence = 'Could not open the payment page — try again in a moment.'
  const sentenceZh = '暂时打不开付款页面，请稍后再试。'
  for (const text of [page, checkout]) {
    assert.equal(text.includes(sentence), true)
    assert.equal(text.includes(sentenceZh), true)
    assert.equal(text.includes('we will email you how to pay'), false)
    assert.equal(text.includes('邮件告诉你付款方式'), false)
    assert.equal(text.includes('Request invoice'), false)
    assert.equal(text.includes('索取发票'), false)
  }
  assert.equal(page.includes('Live the second you pay'), false)
  assert.equal(page.includes('付款即上线'), false)
  const pricing = read('../../shared/content/pricing.ts')
  const pricingPage = read('../../app/pages/pricing.vue')
  assert.equal(pricing.includes('Manual review, usually 7–14 days'), false)
  assert.equal(pricing.includes('人工审核，通常 7–14 天'), false)
  assert.equal(pricing.includes('Reviewed by hand'), true)
  assert.equal(pricing.includes('Live on payment'), false)
  assert.equal(pricingPage.includes('Live the second you pay'), false)
  assert.equal(pricingPage.includes('付款即上线'), false)
})

test('the public primary path does not ask for an invoice', () => {
  const files = [
    '../../app/pages/index.vue',
    '../../app/pages/pricing.vue',
    '../../app/pages/billboard.vue',
    '../../app/pages/submit.vue',
    '../../app/components/BlackFridayDeal.vue',
    '../../app/components/BillboardClaimDialog.vue',
    '../../app/components/directory/SubmitForm.vue',
    '../../shared/content/pricing.ts',
  ]
  for (const file of files) {
    const text = read(file)
    for (const phrase of ['Request invoice', 'Invoice confirmed', '索取发票']) {
      assert.equal(text.includes(phrase), false, `${file} still contains ${phrase}`)
    }
  }
})

test('llms.txt and ai.txt describe the live directory and do not hard-code 0 or 49', () => {
  const llms = read('../../server/routes/llms.txt.ts')
  const ai = read('../../server/routes/ai.txt.ts')
  const opening =
    'A directory of software products. Every listing has its own page with what the product does, its category, and its maker.'
  assert.equal(llms.includes(opening), true)
  assert.equal(ai.includes(opening), true)
  assert.equal(llms.includes('publicStats'), true)
  assert.equal(llms.includes('publicListingIndex'), true)
  assert.equal(ai.includes('publicStats'), true)
  assert.equal(llms.includes('lists 0'), false)
  assert.equal(llms.includes('lists 49'), false)
  assert.equal(llms.includes('AI products'), false)
  assert.equal(llms.includes('webhook'), false)
  assert.equal(llms.includes('${SITE}/alternatives'), true)
  assert.equal(ai.includes('and its pricing'), false)
  assert.equal(read('../../server/routes/zh/llms.txt.ts').includes("sendRedirect(event, '/llms.txt', 301)"), true)
})

test('a product title is the name and one-liner, truncated around 60 characters', () => {
  assert.equal(
    listingDocumentTitle('YouTranscripts', 'Turn videos into transcripts'),
    'YouTranscripts — Turn videos into transcripts | Product Atlas',
  )
  const long = 'x'.repeat(80)
  const title = listingDocumentTitle('Name', long)
  const oneLiner = title.slice('Name — '.length, title.indexOf(' | Product Atlas'))
  assert.equal(oneLiner.length, 60)
  assert.equal(oneLiner.endsWith('…'), true)
  assert.equal(title.includes('Features'), false)
  assert.equal(title.includes('Pricing'), false)
  assert.equal(title.includes('Alternatives'), false)
  const page = read('../../app/pages/products/[slug].vue')
  assert.equal(page.includes('listingDocumentTitle'), true)
  assert.equal(page.includes('Features, Pricing & Alternatives'), false)
})

test('english counters use the singular only for 1', () => {
  assert.equal(englishCount(1, 'tool'), 'tool')
  assert.equal(englishCount(2, 'tool'), 'tools')
  assert.equal(englishCount(0, 'spot'), 'spots')
  assert.equal(englishCount(1, 'maker'), 'maker')
  assert.equal(englishCount(1, 'category', 'categories'), 'category')
  const categories = read('../../app/pages/categories/index.vue')
  const billboard = read('../../app/pages/billboard.vue')
  const stats = read('../../app/pages/stats.vue')
  assert.equal(categories.includes('englishCount(card.count, \'tool\')'), true)
  assert.equal(billboard.includes('englishCount(ranked.length, \'spot\')'), true)
  assert.equal(stats.includes('englishCount(row.billboard_confirmed, \'spot\')'), true)
  assert.equal(categories.includes('{count} tools'), false)
})

test('the blog is an empty state and the ShipAny posts are gone', () => {
  const blog = read('../../shared/content/blog.ts')
  const page = read('../../app/pages/blog/index.vue')
  const bodies = read('../../app/utils/blogBodies.ts')
  assert.equal(blog.includes('what-is-shipany'), false)
  assert.equal(blog.includes('blocks-vs-components'), false)
  assert.equal(blog.includes('ShipAny TanStack'), false)
  assert.match(blog, /BLOG_POST_SLUGS = \[\]/)
  assert.equal(page.includes('Blog · Product Atlas'), true)
  assert.equal(page.includes('Notes from Product Atlas. New posts will show up here.'), true)
  assert.equal(page.includes('No posts yet. Check back here for product notes and listing guides.'), true)
  assert.equal(bodies.includes('ShipAny'), false)
  assert.equal(read('../../app/pages/blog/[slug].vue').includes('statusCode: 404'), true)
})

test('submit opens on a URL draft and signs in only to save or pay', () => {
  const page = read('../../app/pages/submit.vue')
  const form = read('../../app/components/directory/SubmitForm.vue')
  assert.equal(page.includes('Submit a product · Product Atlas'), true)
  assert.equal(
    page.includes('Paste your URL first. We draft the listing. Sign in only when you save it or pay.'),
    true,
  )
  assert.equal(page.includes('Submit a product'), true)
  assert.equal(
    page.includes(
      'Paste the product URL. We draft a title, description, and icon from the public page. You edit anything that is wrong, then sign in to save or pay.',
    ),
    true,
  )
  assert.equal(form.includes('Product URL'), true)
  assert.equal(form.includes('placeholder="https://"'), true)
  assert.equal(form.includes('Draft listing'), true)
  assert.equal(form.includes("'/api/fetch-meta'"), true)
  assert.equal(
    form.includes('We could not read that page. You can still add the name, description, and icon yourself.'),
    true,
  )
  assert.equal(form.includes('List for free · $0'), true)
  assert.equal(form.includes('Sign in with Google to save this draft'), true)
  assert.equal(form.includes('Sign in with Google to pay'), true)
  assert.equal(form.includes('Nothing is stored until you sign in and save.'), true)
  assert.equal(form.includes('The form stays closed until you are signed in.'), false)
  assert.equal(form.includes('/api/tools/preview'), false)
  const pricing = read('../../shared/content/pricing.ts')
  assert.equal(
    pricing.includes('Paste the URL first. We draft the listing. Sign in only to save or pay.'),
    true,
  )
  assert.equal(pricing.includes('Submitted in 30 seconds'), false)
  assert.equal(pricing.includes('30 seconds'), false)
})

test('directory regular prices, campaign prices and the deadline stay pinned', () => {
  const campaign = read('../content/campaign.ts')
  const pricing = read('../content/pricing.ts')
  assert.match(campaign, /endsAt: '2026-12-01T06:59:00\+08:00'/)
  assert.match(pricing, /amountCents: 0/)
  assert.match(pricing, /amountCents: 1000/)
  assert.match(pricing, /amountCents: 1900/)
  assert.match(pricing, /amountCents: 3900/)
  assert.match(pricing, /amountCents: 6900/)
  assert.match(pricing, /saleCents: 499/)
  assert.match(pricing, /weeklyCents: 1900/)
  assert.match(pricing, /bundleCents: 7600/)
  assert.match(pricing, /saleWeeklyCents: 900/)
  assert.match(pricing, /saleBundleCents: 3200/)
})
