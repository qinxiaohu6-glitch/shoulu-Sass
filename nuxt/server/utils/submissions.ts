/**
 * Submission intake — the site's only public write path.
 *
 * Ported from the old file store (`submissions.py`), including the rules that
 * were expensive to learn:
 *
 *  * `plan` is an **intent**, not an entitlement. A paid tier stays unpublished
 *    until an operator records the money (`paid_at`); otherwise "free instant
 *    publishing" would be one curl away.
 *  * One live submission per domain. A directory that accepts the same site
 *    twice has to explain to the first submitter why the second listing exists.
 *  * Bounded: a hard cap and a per-IP quota, because an unbounded write
 *    endpoint on a public site is a spam target, not a feature.
 *  * Third-party text lands in our HTML, so markup is stripped here rather
 *    than trusted at render time.
 */

import catalogJson from '~~/shared/content/catalog.json'
import { categories, categoryBySlug, isoWeekId, slugify as slugifyText } from '~~/shared/utils/catalog'
import type { DetailBlock, Tool } from '~~/shared/types/catalog'
import type { Db } from './db'

/* -------------------------------------------------------------------------
   limits
   ------------------------------------------------------------------------- */

const MAX_SUBMISSIONS = 20_000
const PER_IP_HOUR = 5
const PER_IP_DAY = 20

const NAME_MIN = 2
const NAME_MAX = 60
const SHORT_MIN = 20
const SHORT_MAX = 200
const LONG_MIN = 120
const LONG_MAX = 4000
const MAX_TAGS = 4

const STATUSES = ['pending', 'approved', 'rejected'] as const
export type Status = (typeof STATUSES)[number]

/** Approving one of these before `paid_at` would publish what nobody paid for. */
const PAID_PLANS = ['standard', 'featured', 'pro', 'ad'] as const
export const isPaidPlan = (plan: string) => (PAID_PLANS as readonly string[]).includes(plan)

/**
 * `publiclyListed` written as SQL.
 *
 * The sitemap, the listing pages and the admin stats all have to answer "is
 * this row live?" without reading every record into memory, so the rule is
 * spelled once here. Bind `...PAID_PLANS` before any other parameter.
 */
const PAID_PLACEHOLDERS = PAID_PLANS.map(() => '?').join(',')
const PUBLIC_SQL = `status = 'approved' AND (paid_at IS NOT NULL OR plan NOT IN (${PAID_PLACEHOLDERS}))`

const PLANS = ['free', 'standard', 'featured', 'pro', 'ad'] as const

/* -------------------------------------------------------------------------
   catalogue index
   ------------------------------------------------------------------------- */

type CatalogIndex = {
  cats: Set<string>
  /** Tags are stored by their English name ("API"), not their slug. */
  tags: Set<string>
  /** Domains already in the curated catalogue — a submission may not shadow one. */
  taken: Set<string>
  slugs: Set<string>
}

let index: CatalogIndex | null = null

function catalogIndex(): CatalogIndex {
  if (index) return index
  const data = catalogJson as unknown as {
    categories: { slug: string }[]
    tags: { name_en: string }[]
    tools: { slug: string; url: string }[]
  }
  const cats = new Set<string>()
  for (const c of data.categories) if (c.slug) cats.add(c.slug)

  const tags = new Set<string>()
  for (const t of data.tags) if (t.name_en) tags.add(t.name_en)

  const taken = new Set<string>()
  const slugs = new Set<string>()
  for (const tool of data.tools) {
    const d = domainOf(tool.url || '')
    if (d) taken.add(d)
    if (tool.slug) slugs.add(tool.slug)
  }

  index = { cats, tags, taken, slugs }
  return index
}

/* -------------------------------------------------------------------------
   normalisation
   ------------------------------------------------------------------------- */

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/
const EMAIL_RE = /^[^@\s]{1,64}@[^@\s.]{1,64}(\.[^@\s.]{1,63})+$/

/**
 * Bare registrable host from a URL, or null.
 *
 * `www.` is dropped so `https://www.foo.com` and `foo.com` collide on purpose:
 * the duplicate check is about the site, not the hostname someone typed.
 */
export function domainOf(url: string): string | null {
  let d = (url || '').trim().toLowerCase()
  d = d.replace(/^[a-z]+:\/\//, '')
  d = d.split('/')[0]!.split('?')[0]!.split('#')[0]!
  d = d.split('@').pop()!.split(':')[0]!
  d = d.replace(/^www\./, '').replace(/\.+$/, '')
  if (!d || d.length > 253) return null
  return DOMAIN_RE.test(d) ? d : null
}

export class SubmissionError extends Error {
  constructor(
    public code: string,
    public field?: string,
    public detail?: string,
  ) {
    super(code)
  }
}

/**
 * Return `[absoluteUrl, domain]` or throw.
 *
 * Only http(s) survives: a `javascript:` or `data:` URL in a listing is an
 * XSS payload with a friendly name.
 */
export function cleanUrl(raw: unknown): [string, string] {
  let u = String(raw ?? '').trim()
  if (!u || u.length > 300) throw new SubmissionError('invalid_url', 'url')
  if (/\s/.test(u)) throw new SubmissionError('invalid_url', 'url')

  const low = u.toLowerCase()
  if (!low.startsWith('http://') && !low.startsWith('https://')) {
    // ftp://, javascript:, data: — refuse rather than silently upgrading.
    if (u.includes('://')) throw new SubmissionError('invalid_url', 'url')
    u = `https://${u}`
  }

  const domain = domainOf(u)
  if (!domain) throw new SubmissionError('invalid_url', 'url')
  if (domain.endsWith('.local') || domain.endsWith('.internal')) {
    throw new SubmissionError('invalid_url', 'url')
  }
  return [u, domain]
}

const TAG_STRIP = /<[^>]{0,200}>/g

/** Strip markup, collapse whitespace, bound the length, refuse embedded links. */
export function cleanText(
  raw: unknown,
  field: string,
  minLen: number,
  maxLen: number,
  required = true,
): string {
  let s = String(raw ?? '').replace(TAG_STRIP, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  if (!s) {
    if (required) throw new SubmissionError('required', field)
    return ''
  }
  if (s.length < minLen) throw new SubmissionError('too_short', field)
  if (s.length > maxLen) s = s.slice(0, maxLen).trimEnd()
  const low = s.toLowerCase()
  // Links belong in the `url` field; links inside copy are how a listing turns
  // into an advert for something else.
  if (low.includes('http://') || low.includes('https://')) {
    throw new SubmissionError('no_links', field)
  }
  return s
}

function slugify(name: string, domain: string): string {
  let base = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48)
    .replace(/^-+|-+$/g, '')
  if (base.length < 2) {
    // Chinese / non-Latin names produce nothing usable — fall back to the
    // domain, which is always ASCII.
    base = domain.split('.')[0]!.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product'
  }
  return base
}

/* -------------------------------------------------------------------------
   validation
   ------------------------------------------------------------------------- */

export type CleanSubmission = {
  url: string
  domain: string
  name: string
  short: string
  long: string
  category: string
  tags: string[]
  email: string
  logo: string
  maker: string
  plan: string
  slot: string
}

export function validate(payload: unknown): CleanSubmission {
  if (!payload || typeof payload !== 'object') throw new SubmissionError('bad_payload')
  const body = payload as Record<string, unknown>
  const cat = catalogIndex()

  // The wizard keeps two URL fields: `url` from step 1 and `website`, the
  // editable copy in step 2. Whatever the submitter last saw wins.
  const [url, domain] = cleanUrl(body.url || body.website)
  if (cat.taken.has(domain)) throw new SubmissionError('already_listed', 'url', domain)

  const name = cleanText(body.name, 'name', NAME_MIN, NAME_MAX)
  const short = cleanText(body.short, 'short', SHORT_MIN, SHORT_MAX)
  const long = cleanText(body.long, 'long', LONG_MIN, LONG_MAX, false)

  const category = String(body.category ?? '').trim().toLowerCase()
  if (!cat.cats.has(category)) throw new SubmissionError('bad_category', 'category')

  let rawTags: unknown = body.tags ?? []
  if (typeof rawTags === 'string') rawTags = rawTags.split(/[,\s]+/).filter(Boolean)
  // The form posts tag *slugs* while the catalogue stores tools with tag
  // *names* ("API"), so accept either and normalise to the name. Dropping an
  // unknown value silently is right: tags are decoration, not a gate.
  const bySlug = new Map<string, string>()
  for (const t of (catalogJson as unknown as { tags: { slug: string; name_en: string }[] }).tags) {
    if (t.slug && t.name_en) bySlug.set(t.slug, t.name_en)
  }
  const tags: string[] = []
  for (const t of Array.isArray(rawTags) ? rawTags : []) {
    const raw = String(t).trim()
    const tag = bySlug.get(raw.toLowerCase()) ?? raw
    if (cat.tags.has(tag) && !tags.includes(tag)) tags.push(tag)
    if (tags.length >= MAX_TAGS) break
  }

  const email = String(body.email ?? '').trim()
  if (email && !EMAIL_RE.test(email)) throw new SubmissionError('bad_email', 'email')

  // "ad" is a weekly placement and the three paid tiers are one-time listings.
  // They share one queue because the flow is identical up to payment: someone
  // fills the form, an operator confirms the money, the record is what the
  // invoice is written from. Collapsing them into "free" would bury a paid
  // order with no way to tell it apart; collapsing them into each other would
  // have the operator invoice the wrong amount.
  let plan = String(body.plan ?? 'free').trim().toLowerCase()
  if (plan === 'paid') plan = 'featured' // what the form sent before Standard existed
  if (!(PLANS as readonly string[]).includes(plan)) plan = 'free'

  let logo = String(body.logo ?? '').trim()
  if (logo && !/^https?:\/\//i.test(logo)) logo = ''

  // An ad order has to remember *which* slot was bought. Without it the
  // operator sees "$29 — weekly ad" and cannot tell board from rail.
  let slot = String(body.slot ?? '').trim().toLowerCase()
  if (plan !== 'ad' || !['board', 'sidebar'].includes(slot)) slot = ''

  const maker = cleanText(body.maker, 'maker', 0, 60, false)

  return { url, domain, name, short, long, category, tags, email, logo, maker, plan, slot }
}

/* -------------------------------------------------------------------------
   record shape
   ------------------------------------------------------------------------- */

export type SubmissionRow = {
  id: string
  slug: string
  url: string
  domain: string
  name: string
  short: string
  long_desc: string
  category: string
  tags: string
  email: string
  logo: string
  maker: string
  plan: string
  slot: string
  status: Status
  paid_at: number | null
  payment_ref: string
  awaiting_payment: number
  created_at: number
  updated_at: number
  reviewed_at: number | null
  reviewer: string
  notes: string
  ip_hash: string
  owner_sub: string
  owner_email: string
  /** '' until the operator writes editorial copy in the review queue. */
  detail_en: string
  detail_zh: string
  /** JSON array of bare screenshot filenames or absolute image URLs. */
  shots: string
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return `s_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

async function uniqueSlug(db: Db, name: string, domain: string): Promise<string> {
  const base = slugify(name, domain)
  let candidate = base
  let n = 2
  // The catalogue's own slugs are reserved too, so a submission can never
  // shadow a page that already exists.
  while (catalogIndex().slugs.has(candidate)) {
    candidate = `${base}-${n++}`
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const hit = await db.prepare('SELECT 1 AS x FROM submissions WHERE slug = ?').bind(candidate).first()
    if (!hit) return candidate
    candidate = `${base}-${n++}`
  }
}

export type CreateOptions = {
  ipHash?: string
  owner?: { sub?: string; email?: string } | null
}

/**
 * Validate, de-duplicate and store a new submission.
 *
 * `owner` is the signed-in account when there is one. It is what makes "My
 * submissions" follow a person across browsers; an anonymous submission simply
 * has no owner and can only be tracked locally.
 */
export async function createSubmission(
  db: Db,
  payload: unknown,
  opts: CreateOptions = {},
): Promise<SubmissionRow> {
  const body = validate(payload)

  const live = await db
    .prepare(
      "SELECT id FROM submissions WHERE domain = ? AND status IN ('pending','approved') LIMIT 1",
    )
    .bind(body.domain)
    .first<{ id: string }>()
  if (live) throw new SubmissionError('duplicate', 'url', live.id)

  const ipHash = opts.ipHash ?? ''
  if (ipHash) {
    const now = Math.floor(Date.now() / 1000)
    const hour = await db
      .prepare('SELECT COUNT(*) AS n FROM submissions WHERE ip_hash = ? AND created_at > ?')
      .bind(ipHash, now - 3600)
      .first<{ n: number }>()
    const day = await db
      .prepare('SELECT COUNT(*) AS n FROM submissions WHERE ip_hash = ? AND created_at > ?')
      .bind(ipHash, now - 86_400)
      .first<{ n: number }>()
    if ((hour?.n ?? 0) >= PER_IP_HOUR) throw new SubmissionError('rate_limited', undefined, 'hour')
    if ((day?.n ?? 0) >= PER_IP_DAY) throw new SubmissionError('rate_limited', undefined, 'day')
  }

  const total = await db.prepare('SELECT COUNT(*) AS n FROM submissions').first<{ n: number }>()
  if ((total?.n ?? 0) >= MAX_SUBMISSIONS) throw new SubmissionError('closed')

  const now = Math.floor(Date.now() / 1000)
  const slug = await uniqueSlug(db, body.name, body.domain)

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = randomId()
    try {
      await db
        .prepare(
          `INSERT INTO submissions (
             id, slug, url, domain, name, short, long_desc, category, tags, email, logo,
             maker, plan, slot, status, paid_at, payment_ref, awaiting_payment,
             created_at, updated_at, reviewed_at, reviewer, notes, ip_hash,
             owner_sub, owner_email
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',NULL,'',?,?,?,NULL,'','',?,?,?)`,
        )
        .bind(
          id,
          slug,
          body.url,
          body.domain,
          body.name,
          body.short,
          body.long,
          body.category,
          JSON.stringify(body.tags),
          body.email,
          body.logo,
          body.maker,
          body.plan,
          body.slot,
          isPaidPlan(body.plan) ? 1 : 0,
          now,
          now,
          ipHash,
          String(opts.owner?.sub ?? ''),
          String(opts.owner?.email ?? ''),
        )
        .run()

      const row = await db.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<SubmissionRow>()
      if (!row) throw new SubmissionError('internal_error')
      return row
    } catch (err) {
      // A primary-key collision on a 4-byte random id is unlikely but not
      // impossible; retrying is cheaper than a longer id.
      if (attempt === 4) throw err
    }
  }
  throw new SubmissionError('internal_error')
}

/**
 * What the submitter is allowed to see back.
 *
 * No `ip_hash`, no reviewer notes, no payment reference: those are either
 * about someone else's privacy or about the owner's bookkeeping. Everything
 * here is what the person typed in, plus where the record has got to.
 */
export function publicRecord(row: SubmissionRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    url: row.url,
    domain: row.domain,
    short: row.short,
    category: row.category,
    plan: row.plan,
    slot: row.slot || '',
    status: row.status,
    awaiting_payment: Boolean(row.awaiting_payment),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * The submitter's own order: what they typed, where it got to, and what they paid.
 *
 * `publicRecord` stops at "what you typed and where it got to" on purpose. A
 * payment date and a payment reference are about money, so they are added here —
 * in a shape that is only ever built for the account that owns the row. Keeping
 * them out of `publicRecord` means a future public listing cannot leak them by
 * accident, which is a mistake that would be invisible until it was indexed.
 */
export function ownerRecord(row: SubmissionRow) {
  return {
    ...publicRecord(row),
    // The settings list draws a 40px thumb per row (the source's
    // `DirectoryListIcon`), and `publicRecord` deliberately carries no logo.
    // This shape is only ever built for the row's own owner, so the logo is
    // safe here and stays out of the public payload.
    logo: row.logo,
    paid_at: row.paid_at,
    payment_ref: row.payment_ref || '',
  }
}

/** The admin queue needs the address to reply to, so it is a separate shape. */
export function adminRecord(row: SubmissionRow) {
  return {
    ...publicRecord(row),
    email: row.email,
    maker: row.maker,
    tags: safeTags(row.tags),
    paid_at: row.paid_at,
    notes: row.notes || '',
    logo: row.logo,
    long_desc: row.long_desc,
    detail_en: parseDetail(row.detail_en),
    detail_zh: parseDetail(row.detail_zh),
    shots: safeShots(row.shots),
  }
}

/** `tags` is stored as a JSON string; a malformed one must not 500 the queue. */
function safeTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/* -------------------------------------------------------------------------
   editorial detail — operator-written copy, never submitter-written
   ------------------------------------------------------------------------- */

const EMPTY_DETAIL: DetailBlock = {
  how_to_use: [],
  features: [],
  use_cases: [],
  pros: [],
  cons: [],
  faqs: [],
}

/**
 * Read a stored `DetailBlock` defensively.
 *
 * Rows written before the migration have no such column at all (`undefined`),
 * and a hand-edited row may hold anything. Neither may take a public page down:
 * an unreadable block is simply "no editorial copy yet", which is the state
 * the detail page already knows how to render.
 */
function parseDetail(raw: unknown): DetailBlock {
  if (typeof raw !== 'string' || !raw.trim()) return { ...EMPTY_DETAIL }
  try {
    const value = JSON.parse(raw) as Partial<DetailBlock> | null
    if (!value || typeof value !== 'object') return { ...EMPTY_DETAIL }
    const lines = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 20) : []
    const pairs = (v: unknown) =>
      Array.isArray(v)
        ? v
            .map((item) => {
              const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
              return { title: String(entry.title ?? ''), desc: String(entry.desc ?? '') }
            })
            .filter((item) => item.title || item.desc)
            .slice(0, 20)
        : []
    return {
      how_to_use: lines(value.how_to_use),
      features: pairs(value.features),
      use_cases: pairs(value.use_cases),
      pros: lines(value.pros),
      cons: lines(value.cons),
      faqs: Array.isArray(value.faqs)
        ? value.faqs
            .map((item) => {
              const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
              return { q: String(entry.q ?? ''), a: String(entry.a ?? '') }
            })
            .filter((item) => item.q || item.a)
            .slice(0, 20)
        : [],
    }
  } catch {
    return { ...EMPTY_DETAIL }
  }
}

function safeShots(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 8) : []
  } catch {
    return []
  }
}

function hasDetail(block: DetailBlock): boolean {
  return (
    block.how_to_use.length > 0 ||
    block.features.length > 0 ||
    block.use_cases.length > 0 ||
    block.pros.length > 0 ||
    block.cons.length > 0 ||
    block.faqs.length > 0
  )
}

/** Unix seconds → the `YYYY-MM-DD` the catalogue stores. */
function isoDate(seconds: number): string {
  return new Date(Number(seconds) * 1000).toISOString().slice(0, 10)
}

/**
 * A category that resolves to a catalogue slug, or ''.
 *
 * Rows written by the old file store — and anything seeded by hand — may carry
 * the display name ("Developer Tools") instead of the slug ("coding"). The
 * catalogue is the authority, so the name is matched against it; only then is
 * the value slugified as a last guess. An unknown value becomes empty and the
 * page drops the category link, rather than pointing at a `/categories/…` that
 * 404s.
 */
function categoryOf(raw: string): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (categoryBySlug(value)) return value
  const lower = value.toLowerCase()
  const byName = categories.find(
    (c) => c.name_en.toLowerCase() === lower || c.name_zh === value,
  )
  if (byName) return byName.slug
  const guess = slugifyText(value)
  return guess && categoryBySlug(guess) ? guess : ''
}

/**
 * A published submission expressed as a catalogue `Tool`.
 *
 * The detail page, the cards and the JSON-LD all speak `Tool`, so the mapping
 * happens once here instead of teaching every consumer a second record shape.
 * What the operator wrote in the review queue is passed through verbatim;
 * what nobody wrote is still not invented:
 *
 *  * `shots` / `detail_*` stay empty until an operator fills them in. A gallery
 *    of images we have never seen would be a picture of a different product.
 *  * the `_zh` short/long copies equal the `_en` ones. The submitter wrote one
 *    description; machine-translating it would put words in their mouth. Only
 *    the editorial sections can carry a real translation, written by a human.
 *  * `featured_until` stays empty. A feature *window* is a schedule, and there
 *    is no schedule on a submission — claiming one would expire a paid listing
 *    at a date nobody sold.
 */
export function publicTool(row: SubmissionRow, votesWeek = 0): Tool {
  const votes = Number(votesWeek) || 0
  const detailEn = parseDetail(row.detail_en)
  const detailZh = parseDetail(row.detail_zh)
  return {
    slug: row.slug,
    name_en: row.name,
    name_zh: row.name,
    short_en: row.short,
    short_zh: row.short,
    long_en: row.long_desc,
    long_zh: row.long_desc,
    url: row.url,
    logo: row.logo,
    category: categoryOf(row.category),
    tags: safeTags(row.tags),
    status: row.status,
    is_featured: false,
    // A paid listing was sold a dofollow link; an unpaid one was not. The page
    // only exists once `paid_at` is set, so this is never a promise the
    // invoice did not make.
    is_paid: isPaidPlan(row.plan) && Boolean(row.paid_at),
    featured_until: '',
    votes_total: votes,
    votes_week: votes,
    created_at: isoDate(row.created_at),
    maker: row.maker || '',
    shots: safeShots(row.shots),
    // Only attach a locale block when the operator actually wrote one.
    // `detailFor()` falls back to English when `detail_zh` is *absent*, so an
    // empty object here would hide the English copy on the Chinese page.
    ...(hasDetail(detailEn) ? { detail_en: detailEn } : {}),
    ...(hasDetail(detailZh) ? { detail_zh: detailZh } : {}),
  }
}

/* -------------------------------------------------------------------------
   review and payment — the owner's side of the loop
   ------------------------------------------------------------------------- */

export type AdminAction = 'approve' | 'reject' | 'payment'

/**
 * `plan` is an intention until the money lands.
 *
 * A paid record that has been flipped to `approved` by an older build (or by
 * a direct write) still must not render a public page, so every "is it live"
 * question goes through this one predicate.
 */
export function publiclyListed(row: SubmissionRow): boolean {
  if (row.status !== 'approved') return false
  if (isPaidPlan(row.plan) && !row.paid_at) return false
  return true
}

export async function getSubmission(db: Db, id: string): Promise<SubmissionRow | null> {
  if (!id) return null
  return db.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<SubmissionRow>()
}

/**
 * The public face of a submission, found by the slug its URL carries.
 *
 * The `publiclyListed` gate is applied here rather than at the call site so
 * that a pending record, a rejected one and a paid-but-unpaid one all answer
 * exactly like a slug that never existed. A detail page that could tell those
 * apart would leak the review queue.
 */
export async function getPublicBySlug(db: Db, slug: string): Promise<SubmissionRow | null> {
  if (!slug) return null
  const row = await db
    .prepare('SELECT * FROM submissions WHERE slug = ?')
    .bind(slug)
    .first<SubmissionRow>()
  if (!row || !publiclyListed(row)) return null
  return row
}

export async function listSubmissions(
  db: Db,
  status: string | null,
  limit = 200,
): Promise<SubmissionRow[]> {
  const capped = Math.max(1, Math.min(500, limit))
  const stmt = status && (STATUSES as readonly string[]).includes(status)
    ? db
        .prepare('SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC LIMIT ?')
        .bind(status, capped)
    : db.prepare('SELECT * FROM submissions ORDER BY created_at DESC LIMIT ?').bind(capped)
  const res = await stmt.all<SubmissionRow>()
  return res.results
}

export async function listByOwner(db: Db, sub: string, limit = 200): Promise<SubmissionRow[]> {
  if (!sub) return []
  const res = await db
    .prepare('SELECT * FROM submissions WHERE owner_sub = ? ORDER BY created_at DESC LIMIT ?')
    .bind(sub, Math.max(1, Math.min(500, limit)))
    .all<SubmissionRow>()
  return res.results
}

/**
 * Every live submission as a catalogue `Tool`, newest first.
 *
 * This is what the listing pages merge with the static catalogue: without it a
 * published listing has a URL but no way to be found, which is the same as not
 * being published. Votes come from the same table the vote button writes to, so
 * the count on a card is never a number nobody can move.
 */
export async function listPublishedTools(db: Db, limit = 500): Promise<Tool[]> {
  const { results } = await db
    .prepare(`SELECT * FROM submissions WHERE ${PUBLIC_SQL} ORDER BY created_at DESC LIMIT ?`)
    .bind(...PAID_PLANS, Math.max(1, Math.min(2000, limit)))
    .all<SubmissionRow>()

  if (!results.length) return []

  // One grouped query rather than one per row: a listing page can carry the
  // whole directory and a per-row count would be N round trips.
  const { results: tallies } = await db
    .prepare('SELECT slug, COUNT(*) AS n FROM votes WHERE week = ? GROUP BY slug')
    .bind(isoWeekId())
    .all<{ slug: string; n: number }>()
  const votes = new Map(tallies.map((row) => [row.slug, Number(row.n)]))

  return results.map((row) => publicTool(row, votes.get(row.slug) ?? 0))
}

/**
 * Approve or reject.
 *
 * Rejecting keeps the record: a domain that was turned down must not be able
 * to re-submit the same thing silently.
 *
 * A paid tier cannot be approved here — the public page and its dofollow link
 * wait for `confirmPayment`. That is the whole point of "paid skips the queue"
 * meaning something.
 */
export async function reviewSubmission(
  db: Db,
  id: string,
  action: 'approve' | 'reject',
  notes = '',
): Promise<SubmissionRow> {
  const row = await getSubmission(db, id)
  if (!row) throw new SubmissionError('not_found')
  if (action === 'approve' && isPaidPlan(row.plan) && !row.paid_at) {
    throw new SubmissionError('payment_required')
  }
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      'UPDATE submissions SET status = ?, notes = ?, reviewed_at = ?, reviewer = ?, updated_at = ? WHERE id = ?',
    )
    .bind(action === 'approve' ? 'approved' : 'rejected', notes.slice(0, 500), now, 'admin', now, id)
    .run()
  return (await getSubmission(db, id))!
}

/**
 * Payment confirmed → the listing goes live without an editorial decision.
 *
 * This is the only path that approves without a human judgement, which is
 * exactly what "paid listings skip the queue" is supposed to mean.
 */
export async function confirmPayment(db: Db, id: string, ref = ''): Promise<SubmissionRow> {
  const row = await getSubmission(db, id)
  if (!row) throw new SubmissionError('not_found')
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      `UPDATE submissions
          SET paid_at = ?, payment_ref = ?, status = 'approved', awaiting_payment = 0,
              reviewed_at = ?, reviewer = 'payment', updated_at = ?
        WHERE id = ?`,
    )
    .bind(now, ref.slice(0, 120), now, now, id)
    .run()
  return (await getSubmission(db, id))!
}

export async function submissionStats(db: Db) {
  const total = await db.prepare('SELECT COUNT(*) AS n FROM submissions').first<{ n: number }>()
  const pending = await db
    .prepare("SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending'")
    .first<{ n: number }>()
  const rejected = await db
    .prepare("SELECT COUNT(*) AS n FROM submissions WHERE status = 'rejected'")
    .first<{ n: number }>()
  const awaiting = await db
    .prepare('SELECT COUNT(*) AS n FROM submissions WHERE awaiting_payment = 1')
    .first<{ n: number }>()
  // "Approved" means publicly visible, so the paid-but-unpaid rows are not
  // counted here — the same rule the detail page uses.
  const approved = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM submissions
        WHERE status = 'approved'
          AND (paid_at IS NOT NULL OR plan NOT IN ('standard','featured','pro','ad'))`,
    )
    .first<{ n: number }>()
  return {
    total: Number(total?.n ?? 0),
    pending: Number(pending?.n ?? 0),
    approved: Number(approved?.n ?? 0),
    rejected: Number(rejected?.n ?? 0),
    awaiting_payment: Number(awaiting?.n ?? 0),
  }
}

/* -------------------------------------------------------------------------
   editorial detail — the operator's save path
   ------------------------------------------------------------------------- */

/** Strip markup and bound every field: this copy lands in rendered HTML. */
function editorialText(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/<[^>]{0,200}>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * Normalise a whole `DetailBlock` from an untrusted request.
 *
 * A malformed row drops out instead of failing the save — losing one stray FAQ
 * is better than losing the other twenty fields the operator just typed. The
 * editor sends the whole block, so "clear this section" is expressible.
 */
export function normalizeDetail(raw: unknown): DetailBlock {
  const block = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const lines = (value: unknown): string[] =>
    (Array.isArray(value) ? value : [])
      .map((item) => editorialText(item, 600))
      .filter(Boolean)
      .slice(0, 20)
  const pairs = (value: unknown) =>
    (Array.isArray(value) ? value : [])
      .map((item) => {
        const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return { title: editorialText(entry.title, 200), desc: editorialText(entry.desc, 2000) }
      })
      .filter((item) => item.title || item.desc)
      .slice(0, 20)
  return {
    how_to_use: lines(block.how_to_use),
    features: pairs(block.features),
    use_cases: pairs(block.use_cases),
    pros: lines(block.pros),
    cons: lines(block.cons),
    faqs: (Array.isArray(block.faqs) ? block.faqs : [])
      .map((item) => {
        const entry = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return { q: editorialText(entry.q, 300), a: editorialText(entry.a, 2000) }
      })
      .filter((item) => item.q || item.a)
      .slice(0, 20),
  }
}

/**
 * Screenshots are bare filenames under `/assets/img/screenshots` (what the
 * curated catalogue uses) or absolute http(s) image URLs. Nothing else becomes
 * an `<img src>`: a `javascript:` value or a path traversal must never reach
 * the gallery.
 */
export function normalizeShots(raw: unknown): string[] {
  const out: string[] = []
  for (const value of Array.isArray(raw) ? raw : []) {
    const text = String(value ?? '').trim().slice(0, 300)
    if (!text) continue
    const absolute = /^https?:\/\/\S+$/i.test(text)
    const filename =
      !text.includes('..') &&
      /^[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp|gif|avif)$/i.test(text)
    if ((absolute || filename) && !out.includes(text)) out.push(text)
    if (out.length >= 8) break
  }
  return out
}

/**
 * Save only editorial copy. Deliberately does not touch `status`, `reviewed_at`
 * or `awaiting_payment`: writing a description is not an approval, and must not
 * send any of the review/payment emails.
 */
export async function saveSubmissionDetail(
  db: Db,
  id: string,
  fields: { detail_en: DetailBlock; detail_zh: DetailBlock; shots: string[] },
): Promise<SubmissionRow> {
  const row = await getSubmission(db, id)
  if (!row) throw new SubmissionError('not_found')
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      'UPDATE submissions SET detail_en = ?, detail_zh = ?, shots = ?, updated_at = ? WHERE id = ?',
    )
    .bind(
      JSON.stringify(fields.detail_en),
      JSON.stringify(fields.detail_zh),
      JSON.stringify(fields.shots),
      now,
      id,
    )
    .run()
  return (await getSubmission(db, id))!
}
