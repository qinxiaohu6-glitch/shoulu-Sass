/**
 * Directory content: database first, catalogue file second.
 *
 * The catalogue (`shared/content/catalog.json`) is the seed and the fallback.
 * A row in `dir_tool` means somebody has edited that listing, and the database
 * wins; no row means the page behaves exactly as it did before the tables
 * existed. That ordering is what makes the migration reversible: dropping the
 * tables restores the old site with no code change.
 *
 * Rows are assembled rather than selected flat: the head row carries the facts
 * that do not translate, each `_tr` row carries one language. A listing edited
 * in English only still renders in Chinese, because the translator falls back
 * to the catalogue's own `_zh` copy for any field the row left empty.
 */

import type { Category, Collection, DetailBlock, Locale, Tag, Tool } from '~~/shared/types/catalog'
import {
  categories as catalogCategories,
  slugify,
  tags as catalogTags,
  tools as catalogTools,
} from '~~/shared/utils/catalog'
import type { Db } from './db'

export interface DirToolHead {
  slug: string
  url: string
  logo: string
  category: string
  tags: string
  status: string
  is_featured: number
  is_paid: number
  featured_until: string
  votes_total: number
  votes_week: number
  created_at: string
  maker: string
  shots: string
  updated_at: number
}

export interface DirToolTr {
  slug: string
  locale: string
  name: string
  short: string
  long_desc: string
  detail: string
  updated_at: number
}

const EMPTY_DETAIL: DetailBlock = {
  how_to_use: [],
  features: [],
  use_cases: [],
  pros: [],
  cons: [],
  faqs: [],
}

function parseArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/**
 * A stored DetailBlock is trusted only as far as its shape. The admin form and
 * the seeder both write whole objects, but a hand-edited row should degrade to
 * "no sections" rather than throw inside a render.
 */
function parseDetail(value: string | null | undefined): DetailBlock | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<DetailBlock>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      how_to_use: Array.isArray(parsed.how_to_use) ? parsed.how_to_use : [],
      features: Array.isArray(parsed.features) ? parsed.features : [],
      use_cases: Array.isArray(parsed.use_cases) ? parsed.use_cases : [],
      pros: Array.isArray(parsed.pros) ? parsed.pros : [],
      cons: Array.isArray(parsed.cons) ? parsed.cons : [],
      faqs: Array.isArray(parsed.faqs) ? parsed.faqs : [],
    }
  } catch {
    return null
  }
}

function hasDetail(detail: DetailBlock | null): boolean {
  if (!detail) return false
  return Boolean(
    detail.how_to_use.length ||
      detail.features.length ||
      detail.use_cases.length ||
      detail.pros.length ||
      detail.cons.length ||
      detail.faqs.length,
  )
}

export interface DirectoryTool {
  tool: Tool
  source: 'db' | 'catalog'
}

/**
 * One listing, ready to hand to `localizeTool`.
 *
 * `head` is required to be the DB row; when it is absent the catalogue answers
 * and `source` says so. Callers use `source` to decide whether the listing is
 * operator-editable, not to branch on behaviour.
 */
export function buildTool(
  head: DirToolHead,
  translations: DirToolTr[],
  fallback: Tool | undefined,
): Tool {
  const byLocale = new Map(translations.map((tr) => [tr.locale, tr]))
  const en = byLocale.get('en')
  const zh = byLocale.get('zh')

  // Per-field fallback, not per-row: an operator who fills in the English copy
  // but leaves Chinese blank gets the catalogue's Chinese, not an English page
  // wearing a /zh URL.
  const pickTr = (locale: Locale, field: 'name' | 'short' | 'long_desc'): string => {
    const own = (locale === 'zh' ? zh : en)?.[field]?.trim()
    if (own) return own
    if (!fallback) return ''
    if (field === 'name') return locale === 'zh' ? fallback.name_zh : fallback.name_en
    if (field === 'short') return locale === 'zh' ? fallback.short_zh : fallback.short_en
    return locale === 'zh' ? fallback.long_zh : fallback.long_en
  }

  const detailEn = parseDetail(en?.detail)
  const detailZh = parseDetail(zh?.detail)

  return {
    slug: head.slug,
    name_en: pickTr('en', 'name'),
    name_zh: pickTr('zh', 'name'),
    short_en: pickTr('en', 'short'),
    short_zh: pickTr('zh', 'short'),
    long_en: pickTr('en', 'long_desc'),
    long_zh: pickTr('zh', 'long_desc'),
    url: head.url || fallback?.url || '',
    logo: head.logo || fallback?.logo || '',
    category: head.category || fallback?.category || '',
    tags: parseArray(head.tags).length ? parseArray(head.tags) : (fallback?.tags ?? []),
    status: head.status,
    is_featured: Boolean(head.is_featured),
    is_paid: Boolean(head.is_paid),
    featured_until: head.featured_until,
    votes_total: head.votes_total,
    votes_week: head.votes_week,
    created_at: head.created_at || fallback?.created_at || '',
    maker: head.maker || fallback?.maker || '',
    shots: parseArray(head.shots).length ? parseArray(head.shots) : (fallback?.shots ?? []),
    // Editorial sections follow the same per-field rule as the copy: an empty
    // block in the row is not "this listing has no sections", it is "nobody has
    // written them here yet" — so the catalogue's block still answers.
    ...(hasDetail(detailEn) ? { detail_en: detailEn! } : fallback?.detail_en ? { detail_en: fallback.detail_en } : {}),
    ...(hasDetail(detailZh) ? { detail_zh: detailZh! } : fallback?.detail_zh ? { detail_zh: fallback.detail_zh } : {}),
  }
}

export async function getDirectoryTool(db: Db, slug: string): Promise<DirectoryTool | null> {
  const fallback = catalogTools.find((tool) => tool.slug === slug)

  // A database that has not been migrated yet must degrade to the catalogue,
  // not 500 every detail page. Deploy order (schema → seed → code) is the
  // operator's job; surviving the wrong order is ours.
  let head: DirToolHead | null = null
  let translations: DirToolTr[] = []
  try {
    head = await db.prepare('SELECT * FROM dir_tool WHERE slug = ?').bind(slug).first<DirToolHead>()
    if (head) {
      const { results } = await db
        .prepare('SELECT * FROM dir_tool_tr WHERE slug = ?')
        .bind(slug)
        .all<DirToolTr>()
      translations = results
    }
  } catch {
    return fallback ? { tool: fallback, source: 'catalog' } : null
  }

  if (!head) {
    return fallback ? { tool: fallback, source: 'catalog' } : null
  }

  return { tool: buildTool(head, translations, fallback), source: 'db' }
}

/**
 * Every listing, database rows first.
 *
 * Ordering is deliberately left to the caller: `orderedTools` already encodes
 * the paid → featured → catalogue rule, and re-deriving it here would give the
 * list page a second, subtly different answer.
 */
export async function listDirectoryTools(db: Db): Promise<Tool[]> {
  let heads: DirToolHead[] = []
  let trs: DirToolTr[] = []
  try {
    heads = (await db.prepare('SELECT * FROM dir_tool').all<DirToolHead>()).results
    if (heads.length) {
      trs = (await db.prepare('SELECT * FROM dir_tool_tr').all<DirToolTr>()).results
    }
  } catch {
    // Unmigrated database: the catalogue is the whole answer.
    return catalogTools
  }
  if (!heads.length) return catalogTools

  const bySlug = new Map<string, DirToolTr[]>()
  for (const tr of trs) {
    const list = bySlug.get(tr.slug) ?? []
    list.push(tr)
    bySlug.set(tr.slug, list)
  }

  const overlaid = heads.map((head) =>
    buildTool(head, bySlug.get(head.slug) ?? [], catalogTools.find((t) => t.slug === head.slug)),
  )

  // Catalogue rows with no override still belong in the list — the tables are
  // an overlay, not a replacement, until the seeder has copied everything.
  const seen = new Set(overlaid.map((tool) => tool.slug))
  return [...overlaid, ...catalogTools.filter((tool) => !seen.has(tool.slug))]
}

/** Which listings have a database row — the console badges the rest "catalogue". */
export async function directoryToolSlugs(db: Db): Promise<Set<string>> {
  try {
    const { results } = await db.prepare('SELECT slug FROM dir_tool').all<{ slug: string }>()
    return new Set(results.map((row) => row.slug))
  } catch {
    return new Set()
  }
}

export async function saveToolTranslation(
  db: Db,
  slug: string,
  locale: Locale,
  fields: { name: string; short: string; long_desc: string; detail: DetailBlock },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO dir_tool_tr (slug, locale, name, short, long_desc, detail, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug, locale) DO UPDATE SET
         name = excluded.name,
         short = excluded.short,
         long_desc = excluded.long_desc,
         detail = excluded.detail,
         updated_at = excluded.updated_at`,
    )
    .bind(
      slug,
      locale,
      fields.name,
      fields.short,
      fields.long_desc,
      JSON.stringify(fields.detail ?? EMPTY_DETAIL),
      Math.floor(Date.now() / 1000),
    )
    .run()
}

export async function ensureToolHead(db: Db, tool: Tool): Promise<void> {
  await db
    .prepare(
      `INSERT INTO dir_tool (
         slug, url, logo, category, tags, status, is_featured, is_paid,
         featured_until, votes_total, votes_week, created_at, maker, shots, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO NOTHING`,
    )
    .bind(
      tool.slug,
      tool.url,
      tool.logo,
      tool.category,
      JSON.stringify(tool.tags),
      tool.status,
      tool.is_featured ? 1 : 0,
      tool.is_paid ? 1 : 0,
      tool.featured_until,
      tool.votes_total,
      tool.votes_week,
      tool.created_at,
      tool.maker,
      JSON.stringify(tool.shots),
      Math.floor(Date.now() / 1000),
    )
    .run()
}

export { EMPTY_DETAIL }

/* ===========================================================================
   taxonomy — categories and tags

   Same overlay rule as the listings: a row means "edited", no row means "the
   catalogue answers". One addition, and it is the difference between a panel
   an operator trusts and one they stop using: a tombstone. Deleting a category
   that the catalogue still contains would otherwise be undone by the next
   read, so removal is `status = 'deleted'` rather than `DELETE`. The row stays
   and "restore" is the same click.

   `dir_tag` has no status column, so a built-in tag cannot be removed — only
   renamed. That is not an oversight: a tag exists because listings carry it,
   so deleting the label while the listings keep the word produces a tag page
   with an untranslated heading. The admin says so instead of pretending.
=========================================================================== */

export interface DirCategoryHead {
  slug: string
  icon: string
  sort: number
  status: string
  updated_at: number
}

export interface DirCategoryTr {
  slug: string
  locale: string
  name: string
  description: string
}

export interface DirTagHead {
  slug: string
  sort: number
  updated_at: number
}

export interface DirTagTr {
  slug: string
  locale: string
  name: string
}

export interface DirCollectionHead {
  slug: string
  icon: string
  cover: string
  sort: number
  status: string
  updated_at: number
}

export interface DirCollectionTr {
  slug: string
  locale: string
  name: string
  description: string
}

export interface DirCollectionTool {
  collection_slug: string
  tool_slug: string
  sort: number
}

function groupBySlug<T extends { slug: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const list = map.get(row.slug) ?? []
    list.push(row)
    map.set(row.slug, list)
  }
  return map
}

export interface TaxonomyCounts {
  byCategory: Map<string, number>
  byTag: Map<string, number>
}

/**
 * Listing counts, derived rather than stored.
 *
 * Storing a count means two writes to keep in sync and one of them eventually
 * losing; counting thirty rows on read costs nothing and cannot drift.
 */
async function listingCounts(db: Db): Promise<TaxonomyCounts> {
  const byCategory = new Map<string, number>()
  const byTag = new Map<string, number>()
  const tools = await listDirectoryTools(db)
  for (const tool of tools) {
    byCategory.set(tool.category, (byCategory.get(tool.category) ?? 0) + 1)
    // Tags are stored as English labels; the tag rows are keyed by slug, so the
    // count has to go through the same `slugify` the tag pages use or "AI" and
    // "ai" become two entries with one listing each.
    for (const label of tool.tags) {
      const slug = slugify(label)
      byTag.set(slug, (byTag.get(slug) ?? 0) + 1)
    }
  }
  return { byCategory, byTag }
}

function buildCategory(
  head: DirCategoryHead,
  translations: DirCategoryTr[],
  fallback: Category | undefined,
  count: number,
): Category {
  const byLocale = new Map(translations.map((tr) => [tr.locale, tr]))
  const pick = (locale: Locale, field: 'name' | 'description'): string => {
    const own = byLocale.get(locale)?.[field]?.trim()
    if (own) return own
    if (!fallback) return ''
    if (field === 'name') return locale === 'zh' ? fallback.name_zh : fallback.name_en
    return locale === 'zh' ? fallback.desc_zh : fallback.desc_en
  }
  return {
    slug: head.slug,
    icon: head.icon || fallback?.icon || '',
    count,
    name_en: pick('en', 'name'),
    name_zh: pick('zh', 'name'),
    desc_en: pick('en', 'description'),
    desc_zh: pick('zh', 'description'),
    status: head.status,
    sort: head.sort,
  }
}

/**
 * `includeDeleted` exists for one caller: the console, which has to list a
 * tombstone so it can be un-tombstoned. Every public page takes the default
 * and never learns the difference between "deleted" and "never existed".
 *
 * `counts` lets `directoryMeta()` count the listings once and hand the same
 * tally to all three lists; passing nothing recomputes it, which is what a
 * single-list caller wants.
 */
export async function listDirectoryCategories(
  db: Db,
  includeDeleted = false,
  counts?: TaxonomyCounts,
): Promise<Category[]> {
  let heads: DirCategoryHead[] = []
  let trs: DirCategoryTr[] = []
  try {
    heads = (await db.prepare('SELECT * FROM dir_category ORDER BY sort, slug').all<DirCategoryHead>()).results
    if (heads.length) {
      trs = (await db.prepare('SELECT * FROM dir_category_tr').all<DirCategoryTr>()).results
    }
  } catch {
    return catalogCategories
  }
  if (!heads.length) return catalogCategories

  const { byCategory } = counts ?? (await listingCounts(db))
  const grouped = groupBySlug(trs)

  const out: Category[] = []
  const seen = new Set<string>()
  for (const head of heads) {
    seen.add(head.slug)
    if (head.status === 'deleted' && !includeDeleted) continue
    out.push(
      buildCategory(
        head,
        grouped.get(head.slug) ?? [],
        catalogCategories.find((c) => c.slug === head.slug),
        byCategory.get(head.slug) ?? 0,
      ),
    )
  }
  // A category the database has never heard of is still a category: the tables
  // are an overlay, not a replacement, until the seeder has copied everything.
  for (const category of catalogCategories) {
    if (seen.has(category.slug)) continue
    out.push({ ...category, count: byCategory.get(category.slug) ?? category.count })
  }
  return out
}

function buildTag(
  head: DirTagHead,
  translations: DirTagTr[],
  fallback: Tag | undefined,
  count: number,
): Tag {
  const byLocale = new Map(translations.map((tr) => [tr.locale, tr]))
  const pick = (locale: Locale): string => {
    const own = byLocale.get(locale)?.name?.trim()
    if (own) return own
    if (!fallback) return head.slug
    return locale === 'zh' ? fallback.name_zh : fallback.name_en
  }
  return {
    slug: head.slug,
    count,
    name_en: pick('en'),
    name_zh: pick('zh'),
    sort: head.sort,
  }
}

export async function listDirectoryTags(db: Db, counts?: TaxonomyCounts): Promise<Tag[]> {
  let heads: DirTagHead[] = []
  let trs: DirTagTr[] = []
  try {
    heads = (await db.prepare('SELECT * FROM dir_tag ORDER BY sort, slug').all<DirTagHead>()).results
    if (heads.length) {
      trs = (await db.prepare('SELECT * FROM dir_tag_tr').all<DirTagTr>()).results
    }
  } catch {
    return catalogTags
  }
  if (!heads.length) return catalogTags

  const { byTag } = counts ?? (await listingCounts(db))
  const grouped = groupBySlug(trs)

  const out: Tag[] = []
  const seen = new Set<string>()
  for (const head of heads) {
    seen.add(head.slug)
    out.push(
      buildTag(head, grouped.get(head.slug) ?? [], catalogTags.find((t) => t.slug === head.slug), byTag.get(head.slug) ?? 0),
    )
  }
  for (const tag of catalogTags) {
    if (seen.has(tag.slug)) continue
    out.push({ ...tag, count: byTag.get(tag.slug) ?? tag.count })
  }
  return out
}

/* ---------------------------------------------------------------------------
   collections — no catalogue fallback at all

   A collection is an editorial act, not a derived view: nothing in
   `catalog.json` implies one, so an empty table means an empty index rather
   than "fall back to the built-in list". Membership is ordered and stored
   separately because the sequence is the whole point.
--------------------------------------------------------------------------- */

function buildCollection(
  head: DirCollectionHead,
  translations: DirCollectionTr[],
  tools: string[],
): Collection {
  const byLocale = new Map(translations.map((tr) => [tr.locale, tr]))
  const pick = (locale: Locale, field: 'name' | 'description'): string =>
    byLocale.get(locale)?.[field]?.trim() ?? ''
  return {
    slug: head.slug,
    icon: head.icon,
    cover: head.cover,
    sort: head.sort,
    status: head.status,
    name_en: pick('en', 'name'),
    name_zh: pick('zh', 'name'),
    desc_en: pick('en', 'description'),
    desc_zh: pick('zh', 'description'),
    tools,
  }
}

export async function listDirectoryCollections(db: Db): Promise<Collection[]> {
  let heads: DirCollectionHead[] = []
  let trs: DirCollectionTr[] = []
  let members: DirCollectionTool[] = []
  try {
    heads = (
      await db.prepare('SELECT * FROM dir_collection ORDER BY sort, slug').all<DirCollectionHead>()
    ).results
    if (heads.length) {
      trs = (await db.prepare('SELECT * FROM dir_collection_tr').all<DirCollectionTr>()).results
      members = (
        await db
          .prepare('SELECT * FROM dir_collection_tool ORDER BY collection_slug, sort')
          .all<DirCollectionTool>()
      ).results
    }
  } catch {
    return []
  }
  if (!heads.length) return []

  const groupedTr = groupBySlug(trs)
  const groupedTools = new Map<string, string[]>()
  for (const row of members) {
    const list = groupedTools.get(row.collection_slug) ?? []
    list.push(row.tool_slug)
    groupedTools.set(row.collection_slug, list)
  }

  return heads.map((head) =>
    buildCollection(head, groupedTr.get(head.slug) ?? [], groupedTools.get(head.slug) ?? []),
  )
}

/* ---------------------------------------------------------------------------
   the whole taxonomy in one read

   Every page needs the category names (a card badge, a breadcrumb) and the tag
   labels (a detail page footer), so the three lists are fetched together rather
   than per component. Counting the listings once and sharing the tally is the
   only reason this exists as a function instead of three calls at the call
   site: `listingCounts()` walks every listing, and doing that three times per
   render is three times the work for one answer.
--------------------------------------------------------------------------- */

export interface DirectoryMeta {
  categories: Category[]
  tags: Tag[]
  collections: Collection[]
}

export async function directoryMeta(db: Db): Promise<DirectoryMeta> {
  const counts = await listingCounts(db)
  const [categories, tags, collections] = await Promise.all([
    listDirectoryCategories(db, false, counts),
    listDirectoryTags(db, counts),
    listDirectoryCollections(db),
  ])
  // A draft collection is not public yet. Filtering here rather than in the
  // list function keeps the console (which reads `listDirectoryCollections`
  // directly) able to see and edit its own drafts.
  return { categories, tags, collections: collections.filter((c) => c.status !== 'draft') }
}

/* ---------------------------------------------------------------------------
   writes

   Every writer is an upsert keyed on the slug, because the admin form has no
   notion of "create" versus "update": the operator opens a row, changes it,
   saves. A slug that is new is a new listing; one that exists is the same
   listing. Nothing here deletes, except the tool path, where a real DELETE is
   what "remove this listing" has to mean.
--------------------------------------------------------------------------- */

export async function saveToolHead(db: Db, tool: Tool): Promise<void> {
  await db
    .prepare(
      `INSERT INTO dir_tool (
         slug, url, logo, category, tags, status, is_featured, is_paid,
         featured_until, votes_total, votes_week, created_at, maker, shots, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         url = excluded.url,
         logo = excluded.logo,
         category = excluded.category,
         tags = excluded.tags,
         status = excluded.status,
         is_featured = excluded.is_featured,
         is_paid = excluded.is_paid,
         featured_until = excluded.featured_until,
         votes_total = excluded.votes_total,
         votes_week = excluded.votes_week,
         created_at = excluded.created_at,
         maker = excluded.maker,
         shots = excluded.shots,
         updated_at = excluded.updated_at`,
    )
    .bind(
      tool.slug,
      tool.url,
      tool.logo,
      tool.category,
      JSON.stringify(tool.tags),
      tool.status || 'approved',
      tool.is_featured ? 1 : 0,
      tool.is_paid ? 1 : 0,
      tool.featured_until,
      tool.votes_total,
      tool.votes_week,
      tool.created_at,
      tool.maker,
      JSON.stringify(tool.shots),
      Math.floor(Date.now() / 1000),
    )
    .run()
}

/** Remove a listing outright. Translations first — no cascade on D1 by default. */
export async function deleteDirectoryTool(db: Db, slug: string): Promise<void> {
  await db.prepare('DELETE FROM dir_tool_tr WHERE slug = ?').bind(slug).run()
  await db.prepare('DELETE FROM dir_tool WHERE slug = ?').bind(slug).run()
}

export interface CategoryInput {
  slug: string
  icon: string
  sort: number
  status: string
  en: { name: string; description: string }
  zh: { name: string; description: string }
}

export async function saveCategory(db: Db, input: CategoryInput): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      `INSERT INTO dir_category (slug, icon, sort, status, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         icon = excluded.icon,
         sort = excluded.sort,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    )
    .bind(input.slug, input.icon, input.sort, input.status || 'published', now)
    .run()

  for (const locale of ['en', 'zh'] as const) {
    const copy = input[locale]
    await db
      .prepare(
        `INSERT INTO dir_category_tr (slug, locale, name, description)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(slug, locale) DO UPDATE SET
           name = excluded.name,
           description = excluded.description`,
      )
      .bind(input.slug, locale, copy.name, copy.description)
      .run()
  }
}

/** Tombstone, not DELETE — the catalogue still contains this slug. */
export async function hideCategory(db: Db, slug: string): Promise<void> {
  const existing = await db
    .prepare('SELECT * FROM dir_category WHERE slug = ?')
    .bind(slug)
    .first<DirCategoryHead>()
  const fallback = catalogCategories.find((c) => c.slug === slug)
  const sort = existing?.sort ?? catalogCategories.findIndex((c) => c.slug === slug)
  await db
    .prepare(
      `INSERT INTO dir_category (slug, icon, sort, status, updated_at)
       VALUES (?, ?, ?, 'deleted', ?)
       ON CONFLICT(slug) DO UPDATE SET status = 'deleted', updated_at = excluded.updated_at`,
    )
    .bind(slug, existing?.icon ?? fallback?.icon ?? '', sort < 0 ? 0 : sort, Math.floor(Date.now() / 1000))
    .run()
}

export interface TagInput {
  slug: string
  sort: number
  en: { name: string }
  zh: { name: string }
}

export async function saveTag(db: Db, input: TagInput): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      `INSERT INTO dir_tag (slug, sort, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET sort = excluded.sort, updated_at = excluded.updated_at`,
    )
    .bind(input.slug, input.sort, now)
    .run()

  for (const locale of ['en', 'zh'] as const) {
    await db
      .prepare(
        `INSERT INTO dir_tag_tr (slug, locale, name)
         VALUES (?, ?, ?)
         ON CONFLICT(slug, locale) DO UPDATE SET name = excluded.name`,
      )
      .bind(input.slug, locale, input[locale].name)
      .run()
  }
}

/**
 * Only a tag the database itself introduced can go away.
 *
 * A built-in tag is referenced by listings through its label; deleting the row
 * would leave those listings pointing at a slug with no name, and the next
 * read would resurrect it from the catalogue anyway. Returning `false` lets
 * the panel say "rename it instead" rather than showing a success toast for
 * something that did not happen.
 */
export async function deleteTag(db: Db, slug: string): Promise<boolean> {
  if (catalogTags.some((tag) => tag.slug === slug)) return false
  await db.prepare('DELETE FROM dir_tag_tr WHERE slug = ?').bind(slug).run()
  await db.prepare('DELETE FROM dir_tag WHERE slug = ?').bind(slug).run()
  return true
}

export interface CollectionInput {
  slug: string
  icon: string
  cover: string
  sort: number
  status: string
  en: { name: string; description: string }
  zh: { name: string; description: string }
  tools: string[]
}

export async function saveCollection(db: Db, input: CollectionInput): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(
      `INSERT INTO dir_collection (slug, icon, cover, sort, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         icon = excluded.icon,
         cover = excluded.cover,
         sort = excluded.sort,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    )
    .bind(input.slug, input.icon, input.cover, input.sort, input.status || 'published', now)
    .run()

  for (const locale of ['en', 'zh'] as const) {
    const copy = input[locale]
    await db
      .prepare(
        `INSERT INTO dir_collection_tr (slug, locale, name, description)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(slug, locale) DO UPDATE SET
           name = excluded.name,
           description = excluded.description`,
      )
      .bind(input.slug, locale, copy.name, copy.description)
      .run()
  }

  // Membership is replaced wholesale: the editor sends the finished sequence,
  // and reconciling row by row would have to guess whether a move or a delete
  // happened. The table is small and the write is one statement per row.
  await db.prepare('DELETE FROM dir_collection_tool WHERE collection_slug = ?').bind(input.slug).run()
  for (const [index, toolSlug] of input.tools.entries()) {
    await db
      .prepare('INSERT INTO dir_collection_tool (collection_slug, tool_slug, sort) VALUES (?, ?, ?)')
      .bind(input.slug, toolSlug, index)
      .run()
  }
}

export async function deleteCollection(db: Db, slug: string): Promise<void> {
  await db.prepare('DELETE FROM dir_collection_tool WHERE collection_slug = ?').bind(slug).run()
  await db.prepare('DELETE FROM dir_collection_tr WHERE slug = ?').bind(slug).run()
  await db.prepare('DELETE FROM dir_collection WHERE slug = ?').bind(slug).run()
}
