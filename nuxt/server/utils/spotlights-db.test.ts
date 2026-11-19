/**
 * Spotlight review-queue regression, against a real in-memory SQLite database.
 *
 * The DDL is read out of `server/database/schema.sql` rather than retyped here:
 * the columns this module selects and inserts have to match the table D1
 * actually gets, and a hand-copied `CREATE TABLE` would keep passing after the
 * two drifted apart.
 *
 * What is pinned, in order of how expensive it would be to get wrong:
 *
 *  - a draft is invisible to the public until it is approved, and a pending
 *    draft is indistinguishable from a missing one over HTTP;
 *  - one article per product, but a rejection does not burn the slot;
 *  - `published_at` is the single "is it live" switch, so unpublish and
 *    re-publish are one column and do not move the article's date;
 *  - the public projection never carries the submitter's address.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { Db, DbStatement } from './db.ts'
import {
  createSpotlight,
  getPublished,
  listPublished,
  listSpotlights,
  recentFromEmail,
  recentFromIp,
  reviewSpotlight,
  spotlightStats,
  SpotlightError,
  validateDraft,
} from './spotlights.ts'

const here = dirname(fileURLToPath(import.meta.url))

/** The `spotlight` DDL exactly as the migration file writes it. */
function spotlightDdl(): string {
  const schema = readFileSync(join(here, '../database/schema.sql'), 'utf8')
  const start = schema.indexOf('CREATE TABLE IF NOT EXISTS spotlight')
  assert.ok(start > -1, 'schema.sql has no spotlight table')
  const end = schema.indexOf(');', start)
  assert.ok(end > start, 'spotlight CREATE TABLE is unterminated')
  const table = schema.slice(start, end + 2)
  const indexes = [...schema.matchAll(/CREATE INDEX[^;]*ON spotlight[^;]*;/g)].map((m) => m[0])
  return [table, ...indexes].join('\n')
}

function memoryDb(): Db {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(spotlightDdl())
  return {
    prepare(sql: string): DbStatement {
      const stmt = sqlite.prepare(sql)
      let bound: unknown[] = []
      const api: DbStatement = {
        bind(...values: unknown[]) {
          bound = values
          return api
        },
        async first<T>() {
          const row = stmt.get(...(bound as [])) as T | undefined
          return row ?? null
        },
        async all<T>() {
          return { results: stmt.all(...(bound as [])) as T[] }
        },
        async run() {
          const info = stmt.run(...(bound as []))
          return { changes: Number(info.changes ?? 0) }
        },
      }
      return api
    },
    async exec(sql: string) {
      sqlite.exec(sql)
    },
  }
}

function body(words: number): string {
  return Array.from({ length: words }, (_, i) => `word${i % 7}`).join(' ')
}

function draft(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    listingSlug: 'alpha',
    productName: 'Alpha',
    productUrl: 'https://alpha.example.com/',
    tagline: 'The scheduling tool that stopped sending me email digests',
    body: body(900),
    author: 'Dana Reed',
    authorBio: 'Founder of Alpha.',
    bestFor: 'Small teams who ship weekly',
    pricingSummary: 'Free for one project, then $12/month',
    email: 'dana@example.com',
    ...overrides,
  }
}

const LISTED = (slug: string) => ['alpha', 'beta'].includes(slug)

function refusal(fn: () => unknown): string {
  try {
    fn()
  } catch (err) {
    if (err instanceof SpotlightError) return String(err.code)
    throw err
  }
  throw new Error('expected a refusal, got none')
}

test('the word gate refuses a draft outside 800–1,500', () => {
  assert.equal(refusal(() => validateDraft(draft({ body: body(799) }), LISTED)), 'spotlight_short')
  assert.equal(refusal(() => validateDraft(draft({ body: body(1501) }), LISTED)), 'spotlight_long')
  // Both ends are inclusive: the published standard says 800 to 1,500.
  assert.equal(validateDraft(draft({ body: body(800) }), LISTED).body.split(/\s+/).length, 800)
  assert.equal(validateDraft(draft({ body: body(1500) }), LISTED).body.split(/\s+/).length, 1500)
})

test('a draft cannot point at a product that is not listed', () => {
  assert.equal(
    refusal(() => validateDraft(draft({ listingSlug: 'not-in-the-directory' }), LISTED)),
    'spotlight_no_listing',
  )
  assert.equal(refusal(() => validateDraft(draft({ listingSlug: '' }), LISTED)), 'spotlight_no_listing')
})

test('only http(s) URLs and a plausible address survive validation', () => {
  assert.equal(refusal(() => validateDraft(draft({ productUrl: 'javascript:alert(1)' }), LISTED)), 'invalid_url')
  assert.equal(refusal(() => validateDraft(draft({ productUrl: 'not a url' }), LISTED)), 'invalid_url')
  assert.equal(refusal(() => validateDraft(draft({ email: 'nope' }), LISTED)), 'email_required')
  assert.equal(
    validateDraft(draft({ productUrl: 'https://alpha.example.com/app' }), LISTED).productUrl,
    'https://alpha.example.com/app',
  )
})

test('the console may omit the address, but a malformed one is still refused', () => {
  // `/admin/spotlights/new` writes articles that arrived by email; there may be
  // no reply address, and inventing one would send mail into the void.
  const owner = validateDraft(draft({ email: '' }), LISTED, { requireEmail: false })
  assert.equal(owner.email, '')

  // An address that was typed and is wrong must not be silently dropped: the
  // owner would think a notification went out.
  assert.equal(
    refusal(() => validateDraft(draft({ email: 'not-an-address' }), LISTED, { requireEmail: false })),
    'bad_email',
  )
  // The public form still insists on one.
  assert.equal(refusal(() => validateDraft(draft({ email: '' }), LISTED)), 'email_required')
})

test('a new draft is pending, unpublished, and invisible to the public', async () => {
  const db = memoryDb()
  const row = await createSpotlight(db, validateDraft(draft(), LISTED), 'iphash-1')

  assert.equal(row.status, 'pending')
  assert.equal(row.publishedAtMs, null)
  assert.equal(row.slug, 'alpha')

  assert.deepEqual(await listPublished(db), [])
  assert.equal(await getPublished(db, row.slug), null)
  // A pending draft is only visible in the queue, and there with its address.
  const queue = await listSpotlights(db, 'pending')
  assert.equal(queue.length, 1)
  assert.equal(queue[0]!.email, 'dana@example.com')
})

test('one article per product, and a rejection frees the slot', async () => {
  const db = memoryDb()
  const first = await createSpotlight(db, validateDraft(draft(), LISTED), 'ip')

  await assert.rejects(
    () => createSpotlight(db, validateDraft(draft(), LISTED), 'ip'),
    (err: unknown) => err instanceof SpotlightError && err.code === 'spotlight_duplicate',
  )

  await reviewSpotlight(db, first.id, 'reject', { notes: 'Section 4 is the homepage copy.' })
  // The same product may be written about again after a rejection; the point of
  // a rejection is that the draft can be fixed and resent.
  const second = await createSpotlight(db, validateDraft(draft({ body: body(1000) }), LISTED), 'ip')
  assert.equal(second.status, 'pending')
  assert.notEqual(second.id, first.id)
  // The rejected row keeps the reason, which is what the rejection mail sends.
  const rejected = (await listSpotlights(db, 'rejected'))[0]!
  assert.equal(rejected.reviewNotes, 'Section 4 is the homepage copy.')
})

test('approving publishes, and the public projection carries no address', async () => {
  const db = memoryDb()
  const row = await createSpotlight(db, validateDraft(draft(), LISTED), 'ip')
  const approved = await reviewSpotlight(db, row.id, 'approve')

  assert.equal(approved.status, 'approved')
  assert.ok(approved.publishedAtMs)

  const live = await listPublished(db)
  assert.equal(live.length, 1)
  assert.equal(live[0]!.slug, row.slug)
  assert.equal(live[0]!.productName, 'Alpha')
  assert.equal('email' in live[0]!, false, 'the public list leaked the submitter address')
  assert.equal('reviewNotes' in live[0]!, false, 'the public list leaked the review notes')

  const one = await getPublished(db, row.slug)
  assert.equal(one?.slug, row.slug)
  assert.equal('email' in (one ?? {}), false)
})

test('an approve may rename the slug, and cannot take one that is in use', async () => {
  const db = memoryDb()
  const alpha = await createSpotlight(db, validateDraft(draft(), LISTED), 'ip')
  const beta = await createSpotlight(
    db,
    validateDraft(draft({ listingSlug: 'beta', productName: 'Beta', email: 'b@example.com' }), LISTED),
    'ip',
  )

  const renamed = await reviewSpotlight(db, alpha.id, 'approve', { slug: 'alpha-scheduling' })
  assert.equal(renamed.slug, 'alpha-scheduling')
  assert.equal(await getPublished(db, 'alpha'), null)
  assert.ok(await getPublished(db, 'alpha-scheduling'))

  await assert.rejects(
    () => reviewSpotlight(db, beta.id, 'approve', { slug: 'alpha-scheduling' }),
    (err: unknown) => err instanceof SpotlightError && err.code === 'spotlight_slug_taken',
  )
  // A reserved segment would shadow /spotlights/guidelines and friends.
  await assert.rejects(
    () => reviewSpotlight(db, beta.id, 'approve', { slug: 'guidelines' }),
    (err: unknown) => err instanceof SpotlightError && err.code === 'spotlight_slug_taken',
  )
})

test('unpublish takes it off the site without losing the decision', async () => {
  const db = memoryDb()
  const row = await createSpotlight(db, validateDraft(draft(), LISTED), 'ip')
  await reviewSpotlight(db, row.id, 'approve')

  // A fixed past timestamp, so "approving again does not bump the date" is
  // observable: `COALESCE(published_at, now)` is what keeps a second approve
  // from rewriting the article's date.
  await db.prepare('UPDATE spotlight SET published_at = ? WHERE id = ?').bind(1_700_000_000, row.id).run()
  assert.equal((await listPublished(db))[0]!.publishedAt, '2023-11-14')

  const again = await reviewSpotlight(db, row.id, 'approve')
  assert.equal(again.publishedAt, '2023-11-14', 'approving a live article moved its date')

  const off = await reviewSpotlight(db, row.id, 'unpublish')
  assert.equal(off.publishedAtMs, null)
  assert.equal(off.status, 'approved')
  assert.deepEqual(await listPublished(db), [])
  assert.equal(await getPublished(db, row.slug), null)
  // Still approved, so the queue does not show it as awaiting a decision.
  assert.equal((await listSpotlights(db, 'approved')).length, 1)

  // Coming back is a new publication, and the date says so — `published_at` is
  // "live since", not "first written about".
  const back = await reviewSpotlight(db, row.id, 'approve')
  assert.notEqual(back.publishedAt, '2023-11-14')
  assert.equal((await listPublished(db)).length, 1)
})

test('the queue filters by status and the stats agree with it', async () => {
  const db = memoryDb()
  const a = await createSpotlight(db, validateDraft(draft(), LISTED), 'ip')
  const b = await createSpotlight(
    db,
    validateDraft(draft({ listingSlug: 'beta', productName: 'Beta', email: 'b@example.com' }), LISTED),
    'ip',
  )
  await reviewSpotlight(db, a.id, 'approve')
  await reviewSpotlight(db, b.id, 'reject', { notes: 'Too thin.' })

  assert.equal((await listSpotlights(db, 'pending')).length, 0)
  assert.equal((await listSpotlights(db, 'approved')).length, 1)
  assert.equal((await listSpotlights(db, 'rejected')).length, 1)
  assert.equal((await listSpotlights(db, null)).length, 2)

  assert.deepEqual(await spotlightStats(db), {
    total: 2,
    pending: 0,
    approved: 1,
    rejected: 1,
    live: 1,
  })
})

test('an unknown id is a not-found, not a crash', async () => {
  const db = memoryDb()
  await assert.rejects(
    () => reviewSpotlight(db, 'sp_nope', 'approve'),
    (err: unknown) => err instanceof SpotlightError && err.code === 'spotlight_not_found',
  )
})

test('the quotas count by address and by source', async () => {
  const db = memoryDb()
  assert.equal(await recentFromEmail(db, 'dana@example.com', 3600), false)
  await createSpotlight(db, validateDraft(draft(), LISTED), 'ip-a')
  assert.equal(await recentFromEmail(db, 'dana@example.com', 3600), true)
  assert.equal(await recentFromEmail(db, 'other@example.com', 3600), false)

  // A different address from the same source still counts against the source.
  await createSpotlight(
    db,
    validateDraft(draft({ listingSlug: 'beta', productName: 'Beta', email: 'b@example.com' }), LISTED),
    'ip-a',
  )
  assert.equal(await recentFromIp(db, 'ip-a', 3600, 3), false)
  const now = Math.floor(Date.now() / 1000)
  await db.prepare('INSERT INTO spotlight (id, slug, listing_slug, product_name, product_url, tagline, body, email, ip_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind('sp_x', 'x', 'alpha', 'X', 'https://x.example.com/', 't', body(10), 'x@example.com', 'ip-a', now, now)
    .run()
  assert.equal(await recentFromIp(db, 'ip-a', 3600, 3), true)
  assert.equal(await recentFromIp(db, 'ip-b', 3600, 3), false)
  // Outside the window nothing counts: the quota is a rate, not a lifetime cap.
  assert.equal(await recentFromIp(db, 'ip-a', 0, 3), false)
})

test('a slug collision on the generated name gets a suffix instead of failing', async () => {
  const db = memoryDb()
  const first = await createSpotlight(db, validateDraft(draft(), LISTED), 'ip')
  await reviewSpotlight(db, first.id, 'reject')
  // Same product name, same generated slug, but the first row still owns it.
  const second = await createSpotlight(db, validateDraft(draft(), LISTED), 'ip')
  assert.equal(second.slug, 'alpha-2')
})

test('the submission route validates against the live directory and rate-limits', () => {
  const route = readFileSync(join(here, '../api/spotlights/submit.post.ts'), 'utf8')
  assert.match(route, /loadEligibleListedAt/)
  assert.match(route, /recentFromEmail/)
  assert.match(route, /recentFromIp/)
  // The receipt must not echo the address back to the browser.
  assert.equal(/email:\s*row\.email/.test(route), false)

  const admin = readFileSync(join(here, '../api/admin/spotlights.post.ts'), 'utf8')
  // Authorisation runs before any write, and an outsider gets a 404 rather than
  // a 403 that would confirm the route exists.
  assert.ok(admin.indexOf('isAdmin') < admin.indexOf('reviewSpotlight'))
  assert.match(admin, /statusCode: 404/)
})

test('the console create route reuses the same write path and is gated', () => {
  const route = readFileSync(join(here, '../api/admin/spotlights/create.post.ts'), 'utf8')

  // Same validation, with the address optional — not a second validator.
  assert.match(route, /validateDraft\(/)
  assert.match(route, /requireEmail: false/)
  // Composed from the two functions the public flow already uses, so slug
  // generation and the one-article-per-product rule cannot differ by door.
  assert.match(route, /createSpotlight\(/)
  assert.match(route, /reviewSpotlight\(/)
  assert.equal(/INSERT INTO spotlight/.test(route), false, 'the route opened its own write path')

  // Gated before anything is read, and 404 rather than 403.
  assert.ok(route.indexOf('isAdmin') < route.indexOf('validateDraft'))
  assert.match(route, /statusCode: 404/)
  // No address, no mail: `sendMail` is behind the row's own email check.
  assert.match(route, /if \(publish && row\.email\)/)
})
