/**
 * Product Spotlights: the whole read/write layer.
 *
 * One table, three statuses, and one decision per row:
 *
 *   pending   — submitted from `/spotlights/submit`, waiting for the owner
 *   approved  — published; `published_at` is set
 *   rejected  — turned down; the record stays so the same product cannot
 *               quietly re-submit the same draft
 *
 * `published_at` is the only thing that decides whether a row is live. Status
 * says what the owner decided; the timestamp says whether the decision is
 * currently in force, which is what makes "unpublish" a one-column change
 * instead of a fourth status that every query has to remember.
 *
 * The public read never returns a body it has not been told to publish, and it
 * never returns the submitter's address — that column exists for the rejection
 * mail and for the owner's queue.
 */

/**
 * Relative paths with the `.ts` extension, not the `~~/` alias.
 *
 * `node --experimental-strip-types` cannot resolve the Nuxt alias, and this
 * module is imported by `spotlights-db.test.ts` — the test that proves a draft
 * stays invisible until it is approved. `utils/board-week.ts` already does the
 * same for the same reason.
 */
import type { Db } from './db'
import { SUBMIT_ERRORS } from './http.ts'
import {
  SPOTLIGHT_MAX,
  SPOTLIGHT_MAX_WORDS,
  SPOTLIGHT_MIN_WORDS,
  isReservedSpotlightSlug,
  isSpotlightSlug,
  spotlightSlug,
  spotlightWords,
  type Spotlight,
  type SpotlightDraftInput,
  type SpotlightRecord,
  type SpotlightStatus,
} from '../../shared/content/spotlights.ts'

const now = () => Math.floor(Date.now() / 1000)

/**
 * A refusal whose code indexes the shared bilingual table in `utils/http.ts`.
 *
 * Declared with explicit fields rather than TypeScript parameter properties
 * (`constructor(public code: …)`), because `node --experimental-strip-types`
 * refuses that syntax — and this module is imported by a database test. The
 * cost is four lines; the alternative is a test that cannot load the code it
 * is testing.
 */
export class SpotlightError extends Error {
  code: keyof typeof SUBMIT_ERRORS
  field?: string

  constructor(code: keyof typeof SUBMIT_ERRORS, field?: string) {
    super(String(code))
    this.name = 'SpotlightError'
    this.code = code
    this.field = field
  }
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return `sp_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

/* -------------------------------------------------------------------------
   rows
   ------------------------------------------------------------------------- */

type Row = {
  id: string
  slug: string
  listing_slug: string
  product_name: string
  product_url: string
  tagline: string
  body: string
  author: string
  author_bio: string
  best_for: string
  pricing_summary: string
  email: string
  status: string
  review_notes: string
  created_at: number
  updated_at: number
  reviewed_at: number | null
  published_at: number | null
}

const COLUMNS = `id, slug, listing_slug, product_name, product_url, tagline, body,
  author, author_bio, best_for, pricing_summary, email, status, review_notes,
  created_at, updated_at, reviewed_at, published_at`

/**
 * `ip_hash` is written but never selected.
 *
 * The quota query reads it directly, and no payload this module returns should
 * carry it — a hash of an address is still a handle on a person, and nothing in
 * the public or console projection needs one.
 */
const INSERT_COLUMNS = `${COLUMNS}, ip_hash`
const INSERT_MARKS = COLUMNS.split(',').map(() => '?').join(',') + ',?'

/** `YYYY-MM-DD` in UTC. The article date is a date, not a timestamp. */
function isoDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

function toPublic(row: Row): Spotlight {
  return {
    slug: row.slug,
    listingSlug: row.listing_slug,
    productName: row.product_name,
    productUrl: row.product_url,
    tagline: row.tagline,
    body: row.body,
    author: row.author,
    ...(row.author_bio ? { authorBio: row.author_bio } : {}),
    ...(row.best_for ? { bestFor: row.best_for } : {}),
    ...(row.pricing_summary ? { pricingSummary: row.pricing_summary } : {}),
    publishedAt: isoDate(row.published_at ?? row.created_at),
  }
}

function toRecord(row: Row): SpotlightRecord {
  return {
    ...toPublic(row),
    id: row.id,
    email: row.email,
    status: (row.status as SpotlightStatus) ?? 'pending',
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
    publishedAtMs: row.published_at,
  }
}

/* -------------------------------------------------------------------------
   validation
   ------------------------------------------------------------------------- */

function text(value: unknown, max: number): string {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)
}

/** https only. A `javascript:` or `data:` URL in a published article is an XSS. */
function safeUrl(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return ''
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
  return url.toString()
}

function safeEmail(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw) && raw.length <= SPOTLIGHT_MAX.email ? raw : ''
}

/**
 * The normalised draft. Same shape the two forms hold, so the console and the
 * public form post the same thing — see `SpotlightDraftInput`.
 */
export type SpotlightDraft = SpotlightDraftInput

/**
 * Validate a submitted draft.
 *
 * `listingExists` is injected rather than looked up here, so the caller can
 * answer "is that product on the site" with whatever list it already has — the
 * public form checks against the same directory the listing page renders.
 *
 * `requireEmail` is false for the console: an article the owner writes up from
 * an email thread may have no reply address, and demanding one would mean
 * inventing an address that then receives mail. The public form always requires
 * one, because the receipt and the review outcome have nowhere else to go.
 */
export function validateDraft(
  input: Record<string, unknown>,
  listingExists: (slug: string) => boolean,
  options: { requireEmail?: boolean } = {},
): SpotlightDraft {
  const listingSlug = text(input.listingSlug, 120)
  if (!listingSlug || !listingExists(listingSlug)) {
    throw new SpotlightError('spotlight_no_listing', 'listingSlug')
  }

  const productName = text(input.productName, SPOTLIGHT_MAX.productName)
  if (productName.length < 2) throw new SpotlightError('required', 'productName')

  const productUrl = safeUrl(input.productUrl)
  if (!productUrl) throw new SpotlightError('invalid_url', 'productUrl')

  const tagline = text(input.tagline, SPOTLIGHT_MAX.tagline)
  if (tagline.length < 10) throw new SpotlightError('too_short', 'tagline')

  const body = text(input.body, SPOTLIGHT_MAX.body)
  if (!body) throw new SpotlightError('required', 'body')
  const words = spotlightWords(body)
  if (words < SPOTLIGHT_MIN_WORDS) throw new SpotlightError('spotlight_short', 'body')
  if (words > SPOTLIGHT_MAX_WORDS) throw new SpotlightError('spotlight_long', 'body')

  const rawEmail = String(input.email ?? '').trim()
  const email = safeEmail(rawEmail)
  if (!email && (options.requireEmail ?? true)) throw new SpotlightError('email_required', 'email')
  // A malformed address is refused even when it is optional: silently dropping
  // it would leave the owner thinking a notification went out.
  if (!email && rawEmail) throw new SpotlightError('bad_email', 'email')

  return {
    listingSlug,
    productName,
    productUrl,
    tagline,
    body,
    author: text(input.author, SPOTLIGHT_MAX.author),
    authorBio: text(input.authorBio, SPOTLIGHT_MAX.authorBio),
    bestFor: text(input.bestFor, SPOTLIGHT_MAX.bestFor),
    pricingSummary: text(input.pricingSummary, SPOTLIGHT_MAX.pricingSummary),
    email,
  }
}

/* -------------------------------------------------------------------------
   writes
   ------------------------------------------------------------------------- */

/**
 * A product gets one article. A pending or published row blocks a second one;
 * a rejected row does not, because the point of a rejection is that the writer
 * may fix the draft and send it again.
 */
async function existingForListing(db: Db, listingSlug: string): Promise<Row | null> {
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM spotlight WHERE listing_slug = ? AND status IN ('pending','approved') LIMIT 1`)
    .bind(listingSlug)
    .first<Row>()
  return row ?? null
}

export async function createSpotlight(
  db: Db,
  draft: SpotlightDraft,
  ipHash = '',
): Promise<SpotlightRecord> {
  const clash = await existingForListing(db, draft.listingSlug)
  if (clash) throw new SpotlightError('spotlight_duplicate', 'listingSlug')

  const id = randomId()
  // A slug that is already taken (by a rejected draft, or by an article about a
  // product with the same name) gets a numeric suffix rather than failing the
  // submission over something the writer cannot control.
  const base = spotlightSlug(draft.productName)
  let slug = base
  for (let n = 2; n < 50; n++) {
    const taken = await db.prepare('SELECT 1 AS hit FROM spotlight WHERE slug = ? LIMIT 1').bind(slug).first()
    if (!taken && !isReservedSpotlightSlug(slug)) break
    slug = `${base}-${n}`
  }

  const ts = now()
  await db
    .prepare(`INSERT INTO spotlight (${INSERT_COLUMNS}) VALUES (${INSERT_MARKS})`)
    .bind(
      id,
      slug,
      draft.listingSlug,
      draft.productName,
      draft.productUrl,
      draft.tagline,
      draft.body,
      draft.author,
      draft.authorBio,
      draft.bestFor,
      draft.pricingSummary,
      draft.email,
      'pending',
      '',
      ts,
      ts,
      null,
      null,
      String(ipHash ?? '').slice(0, 64),
    )
    .run()

  const row = await db.prepare(`SELECT ${COLUMNS} FROM spotlight WHERE id = ?`).bind(id).first<Row>()
  return toRecord(row!)
}

/** True when the same address already sent a draft recently. */
export async function recentFromEmail(db: Db, email: string, seconds: number): Promise<boolean> {
  const since = now() - seconds
  const hit = await db
    .prepare('SELECT 1 AS hit FROM spotlight WHERE email = ? AND created_at > ? LIMIT 1')
    .bind(email, since)
    .first()
  return Boolean(hit)
}

/**
 * True when this source already sent `limit` drafts inside the window.
 *
 * Counted separately from the address: the address limit stops one person
 * re-sending, this one stops one person cycling through addresses.
 */
export async function recentFromIp(
  db: Db,
  ipHash: string,
  seconds: number,
  limit = 3,
): Promise<boolean> {
  if (!ipHash) return false
  const since = now() - seconds
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM spotlight WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, since)
    .first<{ n: number }>()
  return Number(row?.n ?? 0) >= limit
}

export type ReviewAction = 'approve' | 'reject' | 'unpublish'

/**
 * The owner's decision.
 *
 * `approve` may take a slug override — the generated one is a guess from the
 * product name, and the owner is the last person who should be forced to keep a
 * guess. `unpublish` keeps the row and clears `published_at`, so re-publishing
 * later is one click rather than a second review.
 */
export async function reviewSpotlight(
  db: Db,
  id: string,
  action: ReviewAction,
  options: { slug?: string; notes?: string } = {},
): Promise<SpotlightRecord> {
  const row = await db.prepare(`SELECT ${COLUMNS} FROM spotlight WHERE id = ?`).bind(id).first<Row>()
  if (!row) throw new SpotlightError('spotlight_not_found')
  const ts = now()

  if (action === 'reject') {
    await db
      .prepare(`UPDATE spotlight SET status = 'rejected', review_notes = ?, reviewed_at = ?, updated_at = ?, published_at = NULL WHERE id = ?`)
      .bind(String(options.notes ?? '').slice(0, 2000), ts, ts, id)
      .run()
  } else if (action === 'unpublish') {
    await db
      .prepare('UPDATE spotlight SET published_at = NULL, updated_at = ? WHERE id = ?')
      .bind(ts, id)
      .run()
  } else {
    const wanted = String(options.slug ?? '').trim()
    const slug = wanted || row.slug
    if (!isSpotlightSlug(slug) || isReservedSpotlightSlug(slug)) {
      throw new SpotlightError('spotlight_slug_taken', 'slug')
    }
    if (slug !== row.slug) {
      const clash = await db
        .prepare('SELECT 1 AS hit FROM spotlight WHERE slug = ? AND id <> ? LIMIT 1')
        .bind(slug, id)
        .first()
      if (clash) throw new SpotlightError('spotlight_slug_taken', 'slug')
    }
    await db
      .prepare(
        `UPDATE spotlight SET status = 'approved', slug = ?, review_notes = ?, reviewed_at = ?,
         updated_at = ?, published_at = COALESCE(published_at, ?) WHERE id = ?`,
      )
      .bind(slug, String(options.notes ?? '').slice(0, 2000), ts, ts, ts, id)
      .run()
  }

  const after = await db.prepare(`SELECT ${COLUMNS} FROM spotlight WHERE id = ?`).bind(id).first<Row>()
  return toRecord(after!)
}

/* -------------------------------------------------------------------------
   reads
   ------------------------------------------------------------------------- */

/** Live articles, newest first. No address, no review notes. */
export async function listPublished(db: Db): Promise<Spotlight[]> {
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM spotlight WHERE published_at IS NOT NULL ORDER BY published_at DESC`)
    .all<Row>()
  return (results ?? []).map(toPublic)
}

export async function getPublished(db: Db, slug: string): Promise<Spotlight | null> {
  if (!isSpotlightSlug(slug)) return null
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM spotlight WHERE slug = ? AND published_at IS NOT NULL LIMIT 1`)
    .bind(slug)
    .first<Row>()
  return row ? toPublic(row) : null
}

/** The owner's queue. `status` empty means everything. */
export async function listSpotlights(db: Db, status?: string | null): Promise<SpotlightRecord[]> {
  const clean = status === 'pending' || status === 'approved' || status === 'rejected' ? status : ''
  const sql = clean
    ? `SELECT ${COLUMNS} FROM spotlight WHERE status = ? ORDER BY updated_at DESC`
    : `SELECT ${COLUMNS} FROM spotlight ORDER BY updated_at DESC`
  const stmt = clean ? db.prepare(sql).bind(clean) : db.prepare(sql)
  const { results } = await stmt.all<Row>()
  return (results ?? []).map(toRecord)
}

export async function spotlightStats(db: Db): Promise<{
  total: number
  pending: number
  approved: number
  rejected: number
  live: number
}> {
  const { results } = await db
    .prepare(
      `SELECT status, COUNT(*) AS n,
        SUM(CASE WHEN published_at IS NOT NULL THEN 1 ELSE 0 END) AS live
       FROM spotlight GROUP BY status`,
    )
    .all<{ status: string; n: number; live: number }>()
  const out = { total: 0, pending: 0, approved: 0, rejected: 0, live: 0 }
  for (const row of results ?? []) {
    const n = Number(row.n) || 0
    out.total += n
    if (row.status === 'pending') out.pending += n
    else if (row.status === 'approved') out.approved += n
    else if (row.status === 'rejected') out.rejected += n
    out.live += Number(row.live) || 0
  }
  return out
}
