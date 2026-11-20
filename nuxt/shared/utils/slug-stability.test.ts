import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * A listing's URL must survive being deleted and re-added.
 *
 * The behaviour lives in two server functions that cannot be imported here (they
 * reach for `~~/` aliases and a D1 handle), so the wiring is asserted against
 * the source: the delete side has to record the slug, and the create side has to
 * read it back before it derives a new one.
 */

const here = dirname(fileURLToPath(import.meta.url))
const read = (rel: string) => readFileSync(join(here, rel), 'utf8')

const submissions = read('../../server/utils/submissions.ts')
const adminDirectory = read('../../server/utils/admin-directory.ts')
const spotlightPage = read('../../app/pages/spotlights/[slug].vue')
const sitemap = read('../../server/routes/sitemap.xml.ts')

function bodyOf(source: string, signature: string): string {
  const start = source.indexOf(signature)
  assert.ok(start > -1, `missing: ${signature}`)
  const end = source.indexOf('\n}\n', start)
  assert.ok(end > start, `unterminated: ${signature}`)
  return source.slice(start, end)
}

test('a new submission reuses the slug its domain had before', () => {
  const body = bodyOf(submissions, 'async function uniqueSlug(')
  const remember = body.indexOf('await rememberedSlug(db, domain)')
  const derive = body.indexOf('let candidate = base')
  assert.ok(remember > -1, 'uniqueSlug() must consult rememberedSlug()')
  assert.ok(derive > -1, 'uniqueSlug() must still have a derived fallback')
  assert.ok(remember < derive, 'the remembered slug is checked before the fallback')
  assert.match(body, /return remembered/, 'a free remembered slug is returned as-is')
})

test('the remembered slug is looked up by domain, newest first', () => {
  const body = bodyOf(submissions, 'async function rememberedSlug(')
  assert.match(body, /FROM product_slug_alias WHERE domain = \?/)
  assert.match(body, /ORDER BY created_at DESC/)
})

test('a remembered slug that is already taken does not steal a page', () => {
  const body = bodyOf(submissions, 'async function slugIsFree(')
  assert.match(body, /catalogIndex\(\)\.slugs\.has/)
  assert.match(body, /isReservedProductSlug/)
  assert.match(body, /FROM submissions WHERE slug = \?/)
})

test('deleting a listing records its slug before the row goes', () => {
  const body = bodyOf(adminDirectory, 'export async function deleteAdminTool(')
  const record = body.indexOf('INSERT INTO product_slug_alias')
  const remove = body.indexOf('DELETE FROM submissions WHERE slug = ?')
  assert.ok(record > -1, 'deleteAdminTool() must record the alias')
  assert.ok(remove > -1, 'deleteAdminTool() must still delete the submission')
  assert.ok(record < remove, 'the alias is written before the row is deleted')
  assert.match(body, /SELECT id, domain FROM submissions/, 'the domain is needed to record it')
})

test('a spotlight does not 404 when its listing moved or left', () => {
  assert.match(spotlightPage, /findSpotlightListing\(/)
  assert.ok(
    !spotlightPage.includes('The listing this spotlight belongs to is not published'),
    'a published article must not become a 404 because its listing moved',
  )
  // The internal link is dropped rather than pointed at a dead page.
  assert.match(spotlightPage, /v-if="listingPath"/)
  // The paid dofollow link only holds while the listing is live.
  assert.match(spotlightPage, /listing \? 'noopener' : 'nofollow noopener'/)
})

test('the sitemap resolves spotlights the same way the page does', () => {
  assert.match(sitemap, /findSpotlightListing\(item\.listingSlug, item\.productUrl/)
})
