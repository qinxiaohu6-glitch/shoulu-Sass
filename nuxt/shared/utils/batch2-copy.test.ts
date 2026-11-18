/**
 * Batch 2: directory mainline, category rules, and the approved P1 sentences.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  ASK_PROMPT,
  BADGE_OPTIONAL,
  BILLBOARD_PAY_AGAIN,
  CATEGORIES_INTRO_EIGHT,
  CATEGORY_AFTER,
  CHECKED_BLOCK,
  FEATURES_EMPTY,
  FOOTER_BACKLINK,
  L2,
  L3,
  L4,
  L5,
  LIVE_NUMBERS,
  LOGIN_GO_LIVE,
  REFUND_FAQ,
  TAGS_INTRO,
  VIDEO_REQUIRED_TAGS,
  WRITTEN_REVIEW_HONEST,
  askAssistantHref,
  askPromptFor,
  categoriesIntro,
  currentPeriodLabel,
  freeQueueLine,
  publicCategoryDescription,
  submissionTagError,
  videoTagSatisfied,
} from './batch2.ts'
import { listingDocumentTitle } from './listing-title.ts'
import { productMarkdown } from './product-markdown.ts'
import { publicProductName } from './public-name.ts'

const here = dirname(fileURLToPath(import.meta.url))

function read(path: string): string {
  return readFileSync(join(here, path), 'utf8')
}

test('ask links prefill the approved prompt, llms.txt, and the current page', () => {
  const page = 'https://dirtool.com/products/chatgpt'
  const prompt = askPromptFor(page)
  assert.equal(prompt.includes(ASK_PROMPT), true)
  assert.equal(prompt.includes('https://dirtool.com/llms.txt'), true)
  assert.equal(prompt.includes(page), true)
  assert.equal(prompt.toLowerCase().includes('uneed'), false)
  for (const assistant of ['chatgpt', 'claude', 'perplexity', 'grok'] as const) {
    const href = askAssistantHref(assistant, page)
    assert.equal(href.includes(encodeURIComponent(ASK_PROMPT)), true)
    assert.equal(href.includes(encodeURIComponent(page)), true)
  }
  const footer = read('../../app/layouts/default.vue')
  const ask = read('../../app/components/AskAssistants.vue')
  assert.equal(footer.includes('AskAssistants'), true)
  assert.equal(footer.includes(FOOTER_BACKLINK), true)
  assert.equal(ask.includes('ChatGPT'), true)
  assert.equal(ask.includes('Claude'), true)
  assert.equal(ask.includes('Perplexity'), true)
  assert.equal(ask.includes('Grok'), true)
  assert.equal(ask.includes('llms.txt'), true)
})

test('product sections enter the title only when they have content', () => {
  const bare = listingDocumentTitle('YouTranscripts', 'Turn videos into transcripts')
  assert.equal(bare.includes('Features'), false)
  assert.equal(bare.includes('Pricing'), false)
  assert.equal(bare.includes('Related'), false)
  assert.equal(bare.includes('Alternatives'), false)
  const full = listingDocumentTitle('YouTranscripts', 'Turn videos into transcripts', 'Product Atlas', {
    features: true,
    pricing: true,
    related: true,
  })
  assert.equal(full.includes('Features, Pricing, Related'), true)
  const featuresOnly = listingDocumentTitle('Name', 'A short line', 'Product Atlas', { features: true })
  assert.equal(featuresOnly.includes('Features'), true)
  assert.equal(featuresOnly.includes('Pricing'), false)
  const page = read('../../app/pages/products/[slug].vue')
  assert.equal(FEATURES_EMPTY, 'This listing does not include a features section.')
  assert.equal(page.includes('FEATURES_EMPTY'), true)
  assert.equal(page.includes('features section yet'), false)
  assert.equal(CHECKED_BLOCK.startsWith('This page checked the public name'), true)
  assert.equal(page.includes('CHECKED_BLOCK'), true)
  assert.equal(page.includes('RELATED_HEADING'), true)
  assert.equal(page.includes('Alternatives'), false)
  const form = read('../../app/components/directory/SubmitForm.vue')
  assert.equal(form.includes('Alternatives'), false)
  const markdown = productMarkdown({
    name: 'Example',
    short: 'A short description of the product.',
    long: '',
    url: 'https://example.com',
    category: 'Video',
    maker: 'Example',
    features: [],
    pricingLabel: '',
    pricingUrl: '',
    related: [],
  })
  assert.equal(markdown.includes(FEATURES_EMPTY), true)
  assert.equal(markdown.includes('## Related'), false)
  assert.equal(markdown.includes(CHECKED_BLOCK), true)
  const markdownRoute = read('../../server/middleware/03-product-markdown.ts')
  assert.equal(markdownRoute.includes('productMarkdown'), true)
  assert.equal(markdownRoute.includes('productMarkdownSlug'), true)
})

test('how it works uses the approved review sentence and does not sell an invoice', () => {
  const page = read('../../app/pages/how-it-works.vue')
  assert.equal(page.includes('L2'), true)
  assert.equal(page.includes('L2_ZH'), true)
  assert.equal(L2.startsWith('Paid listings go live when payment succeeds.'), true)
  assert.equal(page.includes('HOW_FREE_LINK'), true)
  assert.equal(page.includes('HOW_WEEKLY'), true)
  assert.equal(page.includes('BADGE_OPTIONAL'), true)
  assert.equal(page.includes('usually 7–14 days'), false)
  assert.equal(page.toLowerCase().includes('invoice'), false)
  const success = read('../../app/components/directory/SubmitForm.vue')
  const faq = read('../../app/pages/faq.vue')
  assert.equal(success.includes('/how-it-works'), true)
  assert.equal(faq.includes('/how-it-works'), true)
  assert.equal(faq.includes(L3), true)
  assert.equal(faq.includes(L4), true)
  assert.equal(faq.includes('confirm the receipt'), false)
  assert.equal(faq.includes('hand-reviewed'), false)
})

test('homepage no longer carries the live stats strip and pricing uses the new shell', () => {
  const home = read('../../app/pages/index.vue')
  const pricing = read('../../app/pages/pricing.vue')
  const facts = read('../../app/components/LiveDirectoryFacts.vue')
  // Both the homepage hero and the pricing page dropped the long stats strip.
  assert.equal(home.includes('LiveDirectoryFacts'), false)
  // The pricing page now uses the ProductsBoost three-column shell instead of
  // the old live-stats strip; the same numbers stay available on /stats.
  assert.equal(pricing.includes('LiveDirectoryFacts'), false)
  assert.equal(pricing.includes('pb-shell'), true)
  assert.equal(facts.includes('LIVE_NUMBERS'), true)
  assert.equal(LIVE_NUMBERS.includes('No estimated visits or authority.'), true)
  assert.equal(facts.includes('/api/stats'), true)
  assert.equal(facts.includes('freeQueueLine'), true)
  assert.equal(freeQueueLine(33), '33 free listings waiting for review')
  assert.equal(freeQueueLine(1), '1 free listing waiting for review')
  assert.equal(facts.toLowerCase().includes('monthly visits'), false)
  assert.equal(pricing.includes(BADGE_OPTIONAL), true)
  assert.equal(read('../../public/badge.svg').includes('Listed on Product Atlas'), true)
})

test('category and tag rules keep eight slugs and require a video tag', () => {
  const catalog = JSON.parse(read('../../shared/content/catalog.json'))
  const slugs = catalog.categories.map((category: { slug: string }) => category.slug)
  assert.deepEqual(slugs, ['chatbots', 'coding', 'image', 'video', 'audio', 'writing', 'productivity', 'research'])
  assert.equal(catalog.categories.some((category: { name_en: string }) => /video chat/i.test(category.name_en) && category.slug !== 'video'), false)
  for (const [slug, copy] of Object.entries(CATEGORY_AFTER)) {
    const row = catalog.categories.find((category: { slug: string }) => category.slug === slug)
    assert.equal(row.desc_en, copy.en)
  }
  assert.equal(
    catalog.categories.find((category: { slug: string }) => category.slug === 'coding').desc_en,
    'Editors, coding agents and app builders.',
  )
  assert.equal(
    publicCategoryDescription('chatbots', 'en', 'General-purpose assistants you can talk to.'),
    CATEGORY_AFTER.chatbots.en,
  )
  assert.equal(publicCategoryDescription('chatbots', 'en', 'An operator wrote this.'), 'An operator wrote this.')
  const names = catalog.tags.map((tag: { name_en: string }) => tag.name_en)
  for (const tag of VIDEO_REQUIRED_TAGS) assert.equal(names.includes(tag.name), true)
  for (const name of ['Utilities', 'Games', 'Data lookup', 'Ecommerce', 'Face swap']) {
    assert.equal(names.includes(name), true)
  }
  assert.equal(submissionTagError('coding', []), 'tags_required')
  assert.equal(submissionTagError('coding', ['API']), null)
  assert.equal(submissionTagError('video', ['API']), 'video_tag_required')
  assert.equal(submissionTagError('video', ['Video generation']), null)
  assert.equal(submissionTagError('video', ['Video chat']), null)
  assert.equal(submissionTagError('video', ['Transcripts']), null)
  assert.equal(videoTagSatisfied(['Video Generation']), true)
  const tagsPage = read('../../app/pages/tags/index.vue')
  const categoriesPage = read('../../app/pages/categories/index.vue')
  const categoryPage = read('../../app/pages/categories/[slug].vue')
  assert.equal(tagsPage.includes(TAGS_INTRO), true)
  assert.equal(tagsPage.includes('entry.count > 0'), true)
  assert.equal(categoriesPage.includes(CATEGORIES_INTRO_EIGHT) || categoriesPage.includes('categoriesIntro'), true)
  assert.equal(categoriesIntro(8), CATEGORIES_INTRO_EIGHT)
  assert.equal(categoryPage.includes('Best'), false)
  assert.equal(categoryPage.includes('· Product Atlas'), true)
  const form = read('../../app/components/directory/SubmitForm.vue')
  assert.equal(form.includes('submissionTagError'), true)
  assert.equal(form.includes('Video generation, Video chat, or Transcripts.'), true)
  const migration = read('../../server/database/migrations/2026-11-16-taxonomy.sql')
  assert.equal(migration.includes('UPDATE dir_tool'), false)
  assert.equal(migration.includes('DELETE FROM dir_tag'), false)
  assert.equal(migration.includes('video-chat'), true)
})

test('approved P1 sentences replace the old public lines', () => {
  const advertise = read('../../app/pages/advertise.vue')
  const guest = read('../../app/pages/guest-post.vue')
  const auth = read('../../app/components/AuthShell.vue')
  const billboard = read('../../app/pages/billboard.vue')
  const pricing = read('../../shared/content/pricing.ts')
  const products = read('../../app/utils/directory-copy.ts')
  const weekly = read('../../app/pages/weekly.vue')
  const home = read('../../app/pages/index.vue')
  assert.equal(advertise.includes(L5), true)
  assert.equal(guest.includes(WRITTEN_REVIEW_HONEST), true)
  assert.equal(guest.includes('Written review · Product Atlas'), true)
  assert.equal(guest.includes('Share your expertise with our readers.'), false)
  assert.equal(auth.includes(LOGIN_GO_LIVE), true)
  assert.equal(billboard.includes(BILLBOARD_PAY_AGAIN), true)
  assert.equal(billboard.includes('Name your price. Keep the spot.'), true)
  assert.equal(billboard.includes('same website'), false)
  assert.equal(pricing.includes(REFUND_FAQ), true)
  assert.equal(pricing.includes('Full refund before go-live'), false)
  assert.equal(pricing.includes('Priority replies when email is on'), false)
  assert.equal(products.includes('All {count} products · {brand}'), true)
  assert.equal(products.includes('All products'), true)
  assert.equal(products.includes('Best {name}'), false)
  assert.equal(weekly.includes('Current period：'), false)
  assert.equal(weekly.includes('Current period:'), true)
  assert.match(currentPeriodLabel(new Date('2026-11-12T12:00:00Z')), /^Nov 9–Nov 15, 2026 \(W46\)$/)
  assert.equal(home.includes('within 24 hours'), false)
  assert.equal(home.includes('turns email on'), false)
  const layout = read('../../app/layouts/default.vue')
  // Community / maker pages were retired in the ProductsBoost alignment pass;
  // no navigation entry may point at them any more.
  assert.equal(layout.includes("to: '/community'"), false)
  assert.equal(layout.includes("to: '/community/makers'"), false)
  assert.equal(read('../../app/pages/book-ad.vue').includes('has stopped'), false)
  assert.equal(read('../../shared/content/legal.ts').includes('confirms receipt by hand'), true)
})

test('a role suffix is not shown as the product name and the slug helper is separate', () => {
  assert.equal(publicProductName('ClockZone Team'), 'ClockZone')
  assert.equal(publicProductName('CarHistory Team'), 'CarHistory')
  assert.equal(publicProductName('jsonl.co Team'), 'jsonl.co')
  assert.equal(publicProductName('RouteMux Support'), 'RouteMux')
  assert.equal(publicProductName('ChatGPT'), 'ChatGPT')
  const catalog = read('../../shared/utils/catalog.ts')
  assert.equal(catalog.includes('publicProductName'), true)
})
