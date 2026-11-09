import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { canDeleteTool, emptyToolForm, toToolEditPayload } from '../../app/utils/admin-tools-ui.ts'
import { applyOverrideChange, placementStatus } from './listing-order.ts'
import {
  applyTombstone,
  canDeleteStoredListing,
  catalogFallback,
  DELETE_STILL_PUBLISHED,
  deleteListingBlockReason,
  overrideHiddenSlugs,
  rankedBoard,
  submissionSessionOwner,
} from './listing-desk.ts'

const here = dirname(fileURLToPath(import.meta.url))
const read = (rel: string) => readFileSync(join(here, rel), 'utf8')

const SELF_TEST_SLUGS = [
  'peachchat-private-1v1-video-call-with-verified-g',
  'callfreechat',
  'private-1v1-video-chat-with-strangers-online',
]

test('relist clears hidden and does not special-case the self-test slugs', () => {
  for (const slug of SELF_TEST_SLUGS) {
    const hidden = applyOverrideChange(null, slug, 'hidden', true, '', 1)
    assert.ok(hidden)
    assert.equal(hidden.hidden, 1)
    assert.equal(placementStatus('published', true), 'hidden')
    const shown = applyOverrideChange(hidden, slug, 'hidden', false, '', 2)
    assert.equal(shown, null)
    assert.equal(placementStatus('published', false), 'published')
  }

  const src = read('../../server/utils/admin-directory.ts')
  const start = src.indexOf('export async function setAdminToolStatus')
  const end = src.indexOf('export async function deleteAdminTool')
  const fn = src.slice(start, end)
  assert.match(fn, /setOverride\(db, slug, 'hidden', false\)/)
  for (const slug of SELF_TEST_SLUGS) assert.equal(fn.includes(slug), false)

  const page = read('../../app/pages/admin/directory/tools.vue')
  assert.match(page, /admin\.directory\.tools\.relist/)
  assert.match(page, /status: 'published'/)
  const form = toToolEditPayload({ ...emptyToolForm(), status: 'hidden', name: 'Claude' })
  assert.equal('status' in form, false)
  assert.equal(canDeleteTool('hidden'), true)
  assert.equal(canDeleteTool('published'), false)
})

test('hidden counts as unpublished when deciding whether a listing can be deleted', () => {
  assert.equal(canDeleteStoredListing('published', true), true)
  assert.equal(canDeleteStoredListing('published', false), false)
  assert.equal(canDeleteStoredListing('rejected', false), true)
  assert.equal(canDeleteStoredListing('pending', false), true)
  assert.equal(deleteListingBlockReason('published', false), DELETE_STILL_PUBLISHED)
  assert.equal(deleteListingBlockReason('published', true), null)

  const src = read('../../server/utils/admin-directory.ts')
  const start = src.indexOf('export async function deleteAdminTool')
  const end = src.indexOf('export function toAdStatus', start)
  const fn = src.slice(start, end)
  assert.match(fn, /isHidden\(db, clean\)/)
  assert.match(fn, /deleteListingBlockReason/)
  assert.match(fn, /DELETE FROM submissions WHERE slug = \?/)
  assert.match(fn, /tombstoneDirectoryTool/)
  assert.match(fn, /tombstoneOverride/)
  assert.equal(fn.includes('Submitted listings stay in the review queue'), false)

  const page = read('../../app/pages/admin/directory/tools.vue')
  assert.equal(page.includes("source !== 'community'"), false)
  assert.match(page, /canDeleteTool\(row\.status\)/)

  const route = read('../../server/api/admin/directory/tools.delete.ts')
  assert.match(route, /DELETE_STILL_PUBLISHED/)
  assert.match(route, /仅未发布的工具可删除，请先强制下架/)
})

test('a deleted catalogue preset does not come back from the seed or from unhide', () => {
  const seeds = [
    { slug: 'claude', name: 'Claude' },
    { slug: 'cursor', name: 'Cursor' },
  ]
  assert.deepEqual(
    catalogFallback(seeds, [], ['claude']).map((row) => row.slug),
    ['cursor'],
  )
  assert.deepEqual(
    catalogFallback(seeds, ['cursor'], []).map((row) => row.slug),
    ['claude'],
  )

  const tomb = applyTombstone(null, 'claude', 1)
  assert.equal(tomb.removed, 1)
  assert.equal(tomb.hidden, 1)
  const relisted = applyOverrideChange(tomb, 'claude', 'hidden', false, '', 2)
  assert.ok(relisted)
  assert.equal(relisted.hidden, 0)
  assert.equal(relisted.removed, 1)
  assert.deepEqual(overrideHiddenSlugs([relisted]), ['claude'])

  const directory = read('../../server/utils/directory.ts')
  assert.match(directory, /head\?\.status === 'deleted'/)
  assert.match(directory, /catalogFallback/)
})

test('anonymous submit is rejected before a row is created', () => {
  assert.equal(submissionSessionOwner(null), null)
  assert.equal(submissionSessionOwner(undefined), null)
  assert.equal(submissionSessionOwner({ email: 'a@b.c' }), null)
  assert.deepEqual(submissionSessionOwner({ sub: 'google-sub', email: 'a@b.c' }), {
    sub: 'google-sub',
    email: 'a@b.c',
  })

  const src = read('../../server/api/submit.post.ts')
  const gate = src.indexOf("if (!owner) throw new SubmissionError('submit_signin_required')")
  const create = src.indexOf('await createSubmission')
  assert.ok(gate > -1 && create > gate)
  assert.match(src, /submit_signin_required/)
  assert.match(src, /if \(!owner\) throw new SubmissionError\('submit_signin_required'\)/)
  const form = read('../../app/components/directory/SubmitForm.vue')
  assert.match(form, /\/sign-in/)
  assert.match(form, /v-if="!user"/)

  const errors = read('../../server/utils/http.ts')
  assert.match(errors, /submit_signin_required/)
})

test('boards drop hidden slugs and renumber from 1', () => {
  const rows = [
    { slug: 'claude', votes: 188 },
    { slug: 'chatgpt', votes: 170 },
    { slug: 'cursor', votes: 160 },
    { slug: 'midjourney', votes: 140 },
  ]
  const board = rankedBoard(rows, ['claude'], 3)
  assert.deepEqual(
    board.map((row) => row.slug),
    ['chatgpt', 'cursor', 'midjourney'],
  )
  assert.deepEqual(
    board.map((row) => row.rank),
    [1, 2, 3],
  )
  assert.equal(board[0]?.votes, 170)
  assert.equal(rankedBoard(rows, []).length, 4)
  assert.equal(rankedBoard(rows, [])[0]?.rank, 1)

  const index = read('../../app/pages/index.vue')
  assert.match(index, /orderedTools\(lang\.value, overrides\.value\)/)
  const weekly = read('../../app/pages/weekly.vue')
  assert.match(weekly, /rankedBoard\(/)
  const rail = read('../../app/components/TopPicks.vue')
  assert.match(rail, /overrides\.value/)
  const detail = read('../../app/pages/products/[slug].vue')
  assert.match(detail, /overrides\.value/)
  const catalog = read('./catalog.ts')
  assert.match(catalog, /rankedBoard\(source, overrides\.hidden, limit\)/)
})
