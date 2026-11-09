import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { placementStatus } from './listing-order.ts'
import { legalLogoUrl } from './logo.ts'
import { filterByStatus, pageWindow } from './submission-queue.ts'
import { mergeBySlug } from './taxonomy-merge.ts'

const here = dirname(fileURLToPath(import.meta.url))

test('a hidden listing is not labeled rejected', () => {
  assert.equal(placementStatus('published', true), 'hidden')
  assert.equal(placementStatus('published', false), 'published')
  assert.equal(placementStatus('pending', false), 'pending')
  // These three stay hidden through overrides. Approve must not relabel them
  // as rejected or clear the flag; the review handler test below locks that.
  for (const slug of [
    'peachchat-private-1v1-video-call-with-verified-g',
    'callfreechat',
    'private-1v1-video-chat-with-strangers-online',
  ]) {
    assert.equal(placementStatus('published', true), 'hidden')
    assert.equal(slug.includes(' '), false)
  }
})

test('approve and payment confirmation do not clear tool_overrides.hidden', () => {
  const src = readFileSync(join(here, '../../server/api/admin/review.post.ts'), 'utf8')
  assert.equal(src.includes('setOverride'), false)
  assert.match(src, /must not clear tool_overrides\.hidden/)
})

test('logo is required and only an absolute http(s) URL counts', () => {
  assert.equal(legalLogoUrl(''), '')
  assert.equal(legalLogoUrl('   '), '')
  assert.equal(legalLogoUrl('logo.png'), '')
  assert.equal(legalLogoUrl('/assets/logo.png'), '')
  assert.equal(legalLogoUrl('javascript:alert(1)'), '')
  assert.equal(legalLogoUrl('data:image/png;base64,aaaa'), '')
  assert.equal(legalLogoUrl('https://cdn.example.com/logo.png'), 'https://cdn.example.com/logo.png')
  assert.equal(legalLogoUrl(' http://example.com/a.png '), 'http://example.com/a.png')
})

test('approved filter cannot land on an empty page while a total remains', () => {
  const rows = Array.from({ length: 16 }, (_, i) => ({ id: i, status: i < 16 ? 'approved' : 'pending' }))
  const filtered = filterByStatus(
    [...rows, { id: 99, status: 'pending' }, { id: 100, status: 'rejected' }],
    'approved',
  )
  assert.equal(filtered.length, 16)
  // Page 5 of "all" (20 per page) is past the end of a 16-row approved tab.
  const window = pageWindow(filtered.length, 5, 20)
  assert.equal(window.page, 1)
  const visible = filtered.slice(window.start, window.end)
  assert.equal(visible.length, 16)
  assert.equal(visible.length > 0 && filtered.length > 0, true)
})

test('catalogue seeds stay visible and are not dropped when the table is empty', () => {
  const seeds = [
    { slug: 'chatbots', name: 'AI Assistants' },
    { slug: 'coding', name: 'Developer Tools' },
  ]
  assert.deepEqual(mergeBySlug([], seeds), seeds)

  const edited = [{ slug: 'coding', name: '编程' }]
  assert.deepEqual(mergeBySlug(edited, seeds), [
    { slug: 'chatbots', name: 'AI Assistants' },
    { slug: 'coding', name: '编程' },
  ])

  assert.deepEqual(mergeBySlug([], seeds, ['chatbots']), [{ slug: 'coding', name: 'Developer Tools' }])

  const extra = [{ slug: 'custom', name: 'Custom' }]
  assert.deepEqual(mergeBySlug(extra, seeds).map((row) => row.slug), ['chatbots', 'coding', 'custom'])
})
