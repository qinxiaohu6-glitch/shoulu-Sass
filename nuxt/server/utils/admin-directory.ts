/**
 * Admin-side reads and writes for the directory console.
 *
 * The public readers in `server/utils/directory.ts` answer "what does the site
 * show" — they merge the database with the built-in catalogue and return the
 * resolved bilingual view. The console asks a different question: "what rows do
 * I edit, and how many listings point at each". Those are different shapes, so
 * they get different functions rather than a flag threaded through the public
 * ones.
 *
 * Everything here mirrors a handler under the source's
 * `src/server/admin/handlers/directory-*.ts`: same fields, same order, same
 * refusal messages where this build has the same constraint.
 */

import type { Db } from './db'
import { deleteDirectoryTool, hideCategory, listDirectoryTools, saveCategory, saveCollection, saveTag, saveToolHead, saveToolTranslation } from './directory'
import { getAd, listAds, stopAd, today } from './ads'
import { categories, slugify, tags as catalogTags, tools as catalogTools } from '../../shared/utils/catalog'
import { pinWindowActive, pickListingText, placementStatus } from '../../shared/utils/listing-order'
import { mergeBySlug } from '../../shared/utils/taxonomy-merge'
import { loadOverrides, setListingWeight, setOverride, type OverrideState } from './overrides'
import { cleanUrl, domainOf, listPublishedTools, publiclyListed, type SubmissionRow } from './submissions'
import type { Tool } from '../../shared/types/catalog'

/* ---------------------------------------------------------------------------
   schema catch-up

   `dir_tag_tr.description` arrived with the console port: the source's tag form
   edits a per-language blurb and the first release of this schema had no
   column for it. `CREATE TABLE IF NOT EXISTS` in `schema.sql` only helps a
   database created from scratch, so an existing one is brought forward here.

   `PRAGMA table_info` works on D1 as well as on the local SQLite file, and the
   result is memoised for the process, so this costs one round trip on the first
   admin request after a deploy and nothing after that.
--------------------------------------------------------------------------- */

let tagDescriptionReady = false

export async function ensureTagDescriptionColumn(db: Db): Promise<void> {
  if (tagDescriptionReady) return
  const cols = await db.prepare('PRAGMA table_info(dir_tag_tr)').all<{ name: string }>()
  if (!cols.results.some((col) => col.name === 'description')) {
    await db.prepare("ALTER TABLE dir_tag_tr ADD COLUMN description TEXT NOT NULL DEFAULT ''").run()
  }
  tagDescriptionReady = true
}

/* ---------------------------------------------------------------------------
   tags
--------------------------------------------------------------------------- */

export interface AdminTag {
  id: string
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
  toolCount: number
  createdAt: number
}

interface TagHeadRow {
  slug: string
  sort: number
  updated_at: number
}

interface TagTrRow {
  slug: string
  locale: string
  name: string
  description?: string
}

/**
 * Listing counts per tag slug.
 *
 * Tags live on the listing as English labels (`dir_tool.tags` is a JSON array),
 * not as a join table, so the count has to run through the same `slugify` the
 * public tag pages use — otherwise "AI" and "ai" become two entries with one
 * listing each. `directory.ts` does the identical thing for the public counts.
 */
async function tagToolCounts(db: Db): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const tool of await listDirectoryTools(db)) {
    for (const label of tool.tags) {
      const slug = slugify(label)
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
  }
  return counts
}

export async function listAdminTags(
  db: Db,
  params: { page?: number; pageSize?: number; search?: string },
): Promise<{ items: AdminTag[]; total: number }> {
  await ensureTagDescriptionColumn(db)

  const page = Math.max(1, Math.trunc(params.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.trunc(params.pageSize ?? 20)))

  const heads = (await db.prepare('SELECT slug, sort, updated_at FROM dir_tag').all<TagHeadRow>()).results
  const trs = (await db.prepare('SELECT slug, locale, name, description FROM dir_tag_tr').all<TagTrRow>())
    .results
  const counts = await tagToolCounts(db)

  const bySlug = new Map<string, { en?: TagTrRow; zh?: TagTrRow }>()
  for (const tr of trs) {
    const entry = bySlug.get(tr.slug) ?? {}
    if (tr.locale === 'en') entry.en = tr
    if (tr.locale === 'zh') entry.zh = tr
    bySlug.set(tr.slug, entry)
  }

  const stored: AdminTag[] = heads
    .slice()
    .sort((a, b) => a.sort - b.sort || a.slug.localeCompare(b.slug))
    .map((head) => {
      const tr = bySlug.get(head.slug) ?? {}
      return {
        // The slug is the primary key, so it is also the id the console uses.
        id: head.slug,
        slug: head.slug,
        name: tr.en?.name || head.slug,
        description: tr.en?.description ?? '',
        nameZh: tr.zh?.name ?? '',
        descriptionZh: tr.zh?.description ?? '',
        toolCount: counts.get(head.slug) ?? 0,
        createdAt: head.updated_at,
      }
    })
  // Catalogue tags are what the public pills use when this table is empty.
  // Editing one upserts a database row; the seed in catalog.json stays.
  const seeds: AdminTag[] = catalogTags.map((tag) => ({
    id: tag.slug,
    slug: tag.slug,
    name: tag.name_en,
    description: '',
    nameZh: tag.name_zh,
    descriptionZh: '',
    toolCount: counts.get(tag.slug) ?? tag.count ?? 0,
    createdAt: 0,
  }))
  const rows = mergeBySlug(stored, seeds)

  const needle = (params.search ?? '').trim().toLowerCase()
  const filtered = needle
    ? rows.filter(
        (row) =>
          row.slug.includes(needle) ||
          row.name.toLowerCase().includes(needle) ||
          row.nameZh.toLowerCase().includes(needle),
      )
    : rows

  const offset = (page - 1) * pageSize
  return { items: filtered.slice(offset, offset + pageSize), total: filtered.length }
}

/**
 * Source `listDirectoryTagOptions()` — the unpaged `{id, slug, name}` list the
 * tool form's tag picker and the collection drawer read.
 *
 * `id` is the slug here, because `dir_tag` is keyed by slug and the console's
 * forms send slugs back; the source's numeric id never leaves the server.
 */
export async function listAdminTagOptions(db: Db): Promise<{ id: string; slug: string; name: string }[]> {
  const heads = (await db.prepare('SELECT slug FROM dir_tag').all<{ slug: string }>()).results
  const trs = (
    await db.prepare("SELECT slug, name FROM dir_tag_tr WHERE locale = 'zh'").all<{ slug: string; name: string }>()
  ).results
  const names = new Map(trs.map((row) => [row.slug, row.name]))
  const stored = heads.map((head) => ({ id: head.slug, slug: head.slug, name: names.get(head.slug) || head.slug }))
  const seeds = catalogTags.map((tag) => ({ id: tag.slug, slug: tag.slug, name: tag.name_zh || tag.name_en }))
  return mergeBySlug(stored, seeds).sort((a, b) => a.slug.localeCompare(b.slug))
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/

export function tagSlugError(slug: string) {
  return SLUG.test(slug) ? '' : 'Slug must be lowercase letters, numbers and hyphens'
}

/** Every tag the console can address, so create/update can refuse a clash. */
async function tagExists(db: Db, slug: string): Promise<boolean> {
  const row = await db.prepare('SELECT slug FROM dir_tag WHERE slug = ?').bind(slug).first<{ slug: string }>()
  return !!row
}

export interface AdminTagInput {
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
}

export async function createAdminTag(db: Db, input: AdminTagInput): Promise<{ slug: string }> {
  await ensureTagDescriptionColumn(db)
  if (!input.name) throw new Error('name is required')
  if (await tagExists(db, input.slug)) throw new Error('Slug already exists')

  // New tags land at the end of the manual order rather than at 0, where they
  // would jump ahead of the curated list.
  const max = await db.prepare('SELECT COALESCE(MAX(sort), -1) AS max FROM dir_tag').first<{ max: number }>()
  await saveTag(db, {
    slug: input.slug,
    sort: Number(max?.max ?? -1) + 1,
    en: { name: input.name },
    zh: { name: input.nameZh },
  })
  await writeTagDescriptions(db, input.slug, input)
  return { slug: input.slug }
}

export async function updateAdminTag(db: Db, slug: string, input: Omit<AdminTagInput, 'slug'>) {
  await ensureTagDescriptionColumn(db)
  if (!input.name) throw new Error('name is required')

  const head = await db.prepare('SELECT sort FROM dir_tag WHERE slug = ?').bind(slug).first<{ sort: number }>()
  // Edit keeps the existing order; only create appends.
  await saveTag(db, {
    slug,
    sort: Number(head?.sort ?? 0),
    en: { name: input.name },
    zh: { name: input.nameZh },
  })
  await writeTagDescriptions(db, slug, { ...input, slug })
  return { slug }
}

/** Description is written separately: `saveTag` predates the column and keeps
 *  its own signature, which the taxonomy route still calls. */
async function writeTagDescriptions(db: Db, slug: string, input: AdminTagInput) {
  for (const locale of ['en', 'zh'] as const) {
    const description = locale === 'en' ? input.description : input.descriptionZh
    await db
      .prepare('UPDATE dir_tag_tr SET description = ? WHERE slug = ? AND locale = ?')
      .bind(description, slug, locale)
      .run()
  }
}

/* ---------------------------------------------------------------------------
   categories

   Same shape as tags, plus the three columns a category has and a tag does
   not: `icon`, `sort` and `status`. `status` is `published` / `draft` here;
   the third value the table carries, `deleted`, is the tombstone written by
   `hideCategory` and never appears in the console's list.
--------------------------------------------------------------------------- */

export interface AdminCategory {
  id: string
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
  icon: string
  sort: number
  status: string
  toolCount: number
  createdAt: number
}

interface CategoryRow {
  slug: string
  icon: string
  sort: number
  status: string
  updated_at: number
}

interface CategoryTrRow {
  slug: string
  locale: string
  name: string
  description: string
}

export async function listAdminCategories(
  db: Db,
  params: { page?: number; pageSize?: number; search?: string },
): Promise<{ items: AdminCategory[]; total: number }> {
  const page = Math.max(1, Math.trunc(params.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.trunc(params.pageSize ?? 20)))

  const heads = (
    await db
      .prepare("SELECT slug, icon, sort, status, updated_at FROM dir_category WHERE status <> 'deleted'")
      .all<CategoryRow>()
  ).results
  const trs = (await db.prepare('SELECT slug, locale, name, description FROM dir_category_tr').all<CategoryTrRow>())
    .results

  const counts = new Map<string, number>()
  for (const tool of await listDirectoryTools(db)) {
    if (!tool.category) continue
    counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1)
  }

  const bySlug = new Map<string, { en?: CategoryTrRow; zh?: CategoryTrRow }>()
  for (const tr of trs) {
    const entry = bySlug.get(tr.slug) ?? {}
    if (tr.locale === 'en') entry.en = tr
    if (tr.locale === 'zh') entry.zh = tr
    bySlug.set(tr.slug, entry)
  }

  const stored: AdminCategory[] = heads.map((head) => {
    const tr = bySlug.get(head.slug) ?? {}
    return {
      id: head.slug,
      slug: head.slug,
      name: tr.en?.name || head.slug,
      description: tr.en?.description ?? '',
      nameZh: tr.zh?.name ?? '',
      descriptionZh: tr.zh?.description ?? '',
      icon: head.icon,
      sort: head.sort,
      status: head.status === 'draft' ? 'draft' : 'published',
      toolCount: counts.get(head.slug) ?? 0,
      createdAt: head.updated_at,
    }
  })
  const tombstoned = (
    await db.prepare("SELECT slug FROM dir_category WHERE status = 'deleted'").all<{ slug: string }>()
  ).results.map((row) => row.slug)
  // Same eight categories the public nav falls back to when the table is empty.
  const seeds: AdminCategory[] = categories.map((category, index) => ({
    id: category.slug,
    slug: category.slug,
    name: category.name_en,
    description: category.desc_en,
    nameZh: category.name_zh,
    descriptionZh: category.desc_zh,
    icon: category.icon,
    sort: category.sort ?? index,
    status: 'published',
    toolCount: counts.get(category.slug) ?? category.count ?? 0,
    createdAt: 0,
  }))
  const rows = mergeBySlug(stored, seeds, tombstoned).sort(
    (a, b) => a.sort - b.sort || a.slug.localeCompare(b.slug),
  )

  const needle = (params.search ?? '').trim().toLowerCase()
  const filtered = needle
    ? rows.filter(
        (row) =>
          row.slug.includes(needle) ||
          row.name.toLowerCase().includes(needle) ||
          row.nameZh.toLowerCase().includes(needle),
      )
    : rows

  const offset = (page - 1) * pageSize
  return { items: filtered.slice(offset, offset + pageSize), total: filtered.length }
}

/**
 * Source `listDirectoryCategoryOptions()` — unpaged `{id, slug, name}` for the
 * tool form's category select. Drafts are included: an operator may file a new
 * tool under a category before publishing it.
 */
export async function listAdminCategoryOptions(
  db: Db,
): Promise<{ id: string; slug: string; name: string }[]> {
  const heads = (
    await db.prepare("SELECT slug, sort FROM dir_category WHERE status <> 'deleted'").all<{ slug: string; sort: number }>()
  ).results
  const trs = (
    await db.prepare("SELECT slug, name FROM dir_category_tr WHERE locale = 'zh'").all<{ slug: string; name: string }>()
  ).results
  const tombstoned = (
    await db.prepare("SELECT slug FROM dir_category WHERE status = 'deleted'").all<{ slug: string }>()
  ).results.map((row) => row.slug)
  const names = new Map(trs.map((row) => [row.slug, row.name]))
  const stored = heads.map((head) => ({
    id: head.slug,
    slug: head.slug,
    name: names.get(head.slug) || head.slug,
    sort: head.sort,
  }))
  const seeds = categories.map((category, index) => ({
    id: category.slug,
    slug: category.slug,
    name: category.name_zh || category.name_en,
    sort: category.sort ?? index,
  }))
  return mergeBySlug(stored, seeds, tombstoned)
    .sort((a, b) => a.sort - b.sort || a.slug.localeCompare(b.slug))
    .map(({ id, slug, name }) => ({ id, slug, name }))
}

export interface AdminCategoryInput {
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
  icon: string
  sort: number
  status: string
}

async function categoryExists(db: Db, slug: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT slug FROM dir_category WHERE slug = ?')
    .bind(slug)
    .first<{ slug: string }>()
  return !!row
}

export async function createAdminCategory(db: Db, input: AdminCategoryInput) {
  if (!input.name) throw new Error('name is required')
  if (await categoryExists(db, input.slug)) throw new Error('Slug already exists')
  await saveCategory(db, {
    slug: input.slug,
    icon: input.icon,
    sort: input.sort,
    status: input.status,
    en: { name: input.name, description: input.description },
    zh: { name: input.nameZh, description: input.descriptionZh },
  })
  return { slug: input.slug }
}

export async function updateAdminCategory(db: Db, slug: string, input: Omit<AdminCategoryInput, 'slug'>) {
  if (!input.name) throw new Error('name is required')
  await saveCategory(db, {
    slug,
    icon: input.icon,
    sort: input.sort,
    status: input.status,
    en: { name: input.name, description: input.description },
    zh: { name: input.nameZh, description: input.descriptionZh },
  })
  return { slug }
}

/**
 * Refuses while listings still point at the category, and hides rather than
 * deletes.
 *
 * The source deletes the row outright. Here the slug also exists in
 * `catalog.json`, so a hard delete would be undone by the next read that falls
 * back to the catalogue — `hideCategory` writes the `deleted` tombstone instead,
 * which is the same outcome (gone from the console and from the site) that
 * survives a re-read.
 */
export async function deleteAdminCategory(db: Db, slug: string) {
  if (categories.some((category) => category.slug === slug)) {
    throw new Error('Built-in categories stay in the catalogue — edit them instead of deleting')
  }
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM dir_tool WHERE category = ?')
    .bind(slug)
    .first<{ n: number }>()
  if (Number(row?.n ?? 0) > 0) throw new Error('Category still has tools — reassign them first')
  await hideCategory(db, slug)
  return { slug }
}

/* ---------------------------------------------------------------------------
   collections

   A collection is pure editorial content — no catalogue fallback, so unlike a
   category or a tag its rows can be deleted outright. Membership lives in
   `dir_collection_tool` with an explicit `sort`, because the order the editor
   chose is the point of a collection.
--------------------------------------------------------------------------- */

export interface AdminCollection {
  id: string
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
  icon: string
  coverUrl: string
  sort: number
  status: string
  toolCount: number
  toolIds: string[]
  createdAt: number
}

interface CollectionRow {
  slug: string
  icon: string
  cover: string
  sort: number
  status: string
  updated_at: number
}

interface CollectionTrRow {
  slug: string
  locale: string
  name: string
  description: string
}

interface CollectionMemberRow {
  collection_slug: string
  tool_slug: string
  sort: number
}

export async function listAdminCollections(
  db: Db,
  params: { page?: number; pageSize?: number; search?: string },
): Promise<{ items: AdminCollection[]; total: number }> {
  const page = Math.max(1, Math.trunc(params.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.trunc(params.pageSize ?? 20)))

  const heads = (
    await db
      .prepare('SELECT slug, icon, cover, sort, status, updated_at FROM dir_collection')
      .all<CollectionRow>()
  ).results
  const trs = (await db.prepare('SELECT slug, locale, name, description FROM dir_collection_tr').all<CollectionTrRow>())
    .results
  const members = (
    await db
      .prepare('SELECT collection_slug, tool_slug, sort FROM dir_collection_tool ORDER BY sort, tool_slug')
      .all<CollectionMemberRow>()
  ).results

  const bySlug = new Map<string, { en?: CollectionTrRow; zh?: CollectionTrRow }>()
  for (const tr of trs) {
    const entry = bySlug.get(tr.slug) ?? {}
    if (tr.locale === 'en') entry.en = tr
    if (tr.locale === 'zh') entry.zh = tr
    bySlug.set(tr.slug, entry)
  }

  const toolsByCollection = new Map<string, string[]>()
  for (const member of members) {
    const list = toolsByCollection.get(member.collection_slug) ?? []
    list.push(member.tool_slug)
    toolsByCollection.set(member.collection_slug, list)
  }

  const rows: AdminCollection[] = heads
    .slice()
    .sort((a, b) => a.sort - b.sort || a.slug.localeCompare(b.slug))
    .map((head) => {
      const tr = bySlug.get(head.slug) ?? {}
      const toolIds = toolsByCollection.get(head.slug) ?? []
      return {
        id: head.slug,
        slug: head.slug,
        name: tr.en?.name || head.slug,
        description: tr.en?.description ?? '',
        nameZh: tr.zh?.name ?? '',
        descriptionZh: tr.zh?.description ?? '',
        icon: head.icon,
        coverUrl: head.cover,
        sort: head.sort,
        status: head.status === 'draft' ? 'draft' : 'published',
        toolCount: toolIds.length,
        toolIds,
        createdAt: head.updated_at,
      }
    })

  const needle = (params.search ?? '').trim().toLowerCase()
  const filtered = needle
    ? rows.filter(
        (row) =>
          row.slug.includes(needle) ||
          row.name.toLowerCase().includes(needle) ||
          row.nameZh.toLowerCase().includes(needle),
      )
    : rows

  const offset = (page - 1) * pageSize
  return { items: filtered.slice(offset, offset + pageSize), total: filtered.length }
}

/** `{id, slug, name}` for the manage-tools picker, matching `ToolOption`. */
export async function listToolOptions(db: Db): Promise<{ id: string; slug: string; name: string }[]> {
  return (await listDirectoryTools(db))
    .filter((tool) => tool.status === 'approved')
    .map((tool) => ({ id: tool.slug, slug: tool.slug, name: tool.name_en || tool.slug }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export interface AdminCollectionInput {
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
  icon: string
  coverUrl: string
  sort: number
  status: string
}

async function collectionExists(db: Db, slug: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT slug FROM dir_collection WHERE slug = ?')
    .bind(slug)
    .first<{ slug: string }>()
  return !!row
}

export async function createAdminCollection(db: Db, input: AdminCollectionInput) {
  if (!input.name) throw new Error('name is required')
  if (await collectionExists(db, input.slug)) throw new Error('Slug already exists')
  await saveCollection(db, {
    slug: input.slug,
    icon: input.icon,
    cover: input.coverUrl,
    sort: input.sort,
    status: input.status,
    en: { name: input.name, description: input.description },
    zh: { name: input.nameZh, description: input.descriptionZh },
    tools: [],
  })
  return { slug: input.slug }
}

export async function updateAdminCollection(db: Db, slug: string, input: Omit<AdminCollectionInput, 'slug'>) {
  if (!input.name) throw new Error('name is required')
  const current = await db
    .prepare('SELECT tool_slug FROM dir_collection_tool WHERE collection_slug = ? ORDER BY sort, tool_slug')
    .bind(slug)
    .all<{ tool_slug: string }>()
  // The edit form has no membership field, so the existing order is carried
  // through unchanged — writing `[]` here would silently empty the collection.
  await saveCollection(db, {
    slug,
    icon: input.icon,
    cover: input.coverUrl,
    sort: input.sort,
    status: input.status,
    en: { name: input.name, description: input.description },
    zh: { name: input.nameZh, description: input.descriptionZh },
    tools: current.results.map((row) => row.tool_slug),
  })
  return { slug }
}

/** Membership only, used by the manage-tools drawer. */
export async function setCollectionTools(db: Db, slug: string, toolIds: string[]) {
  const head = await db
    .prepare('SELECT slug FROM dir_collection WHERE slug = ?')
    .bind(slug)
    .first<{ slug: string }>()
  if (!head) throw new Error('Collection not found')

  await db.prepare('DELETE FROM dir_collection_tool WHERE collection_slug = ?').bind(slug).run()
  for (const [index, toolSlug] of toolIds.entries()) {
    await db
      .prepare('INSERT INTO dir_collection_tool (collection_slug, tool_slug, sort) VALUES (?, ?, ?)')
      .bind(slug, toolSlug, index)
      .run()
  }
  return { slug }
}

export async function deleteAdminCollection(db: Db, slug: string) {
  await db.prepare('DELETE FROM dir_collection_tool WHERE collection_slug = ?').bind(slug).run()
  await db.prepare('DELETE FROM dir_collection_tr WHERE slug = ?').bind(slug).run()
  await db.prepare('DELETE FROM dir_collection WHERE slug = ?').bind(slug).run()
  return { slug }
}

/* ---------------------------------------------------------------------------
   tools

   The console edits four columns the first release of this schema did not have:
   `pricing`, `source`, `sort` and `sponsored`. They arrive the same way
   `dir_tag_tr.description` did — one idempotent `ALTER TABLE` on first use, so
   an existing D1 database catches up without a manual migration step.
--------------------------------------------------------------------------- */

let toolColumnsReady = false

export async function ensureToolColumns(db: Db): Promise<void> {
  if (toolColumnsReady) return
  const cols = await db.prepare('PRAGMA table_info(dir_tool)').all<{ name: string }>()
  const have = new Set(cols.results.map((col) => col.name))
  const additions: [string, string][] = [
    ['pricing', "pricing TEXT NOT NULL DEFAULT 'free'"],
    ['source', "source TEXT NOT NULL DEFAULT 'editorial'"],
    ['sort', 'sort INTEGER NOT NULL DEFAULT 0'],
    ['sponsored', 'sponsored INTEGER NOT NULL DEFAULT 0'],
  ]
  for (const [name, ddl] of additions) {
    if (!have.has(name)) await db.prepare(`ALTER TABLE dir_tool ADD COLUMN ${ddl}`).run()
  }
  toolColumnsReady = true
}

/** `dir_tool.status` is `approved`; the console calls that `published`. */
function toConsoleStatus(status: string): string {
  if (status === 'approved') return 'published'
  if (status === 'awaiting_payment') return 'pending_payment'
  return status || 'published'
}

export function toStoredStatus(status: string): string {
  if (status === 'published') return 'approved'
  if (status === 'pending_payment') return 'awaiting_payment'
  return status || 'approved'
}

export interface AdminTool {
  id: string
  slug: string
  name: string
  tagline: string
  iconUrl: string
  websiteUrl: string
  pricing: string
  authorName: string
  categoryId: string
  categoryName: string
  source: string
  featured: boolean
  sponsored: boolean
  sort: number
  status: string
  createdAt: string
}

interface ToolExtraRow {
  slug: string
  pricing: string
  source: string
  sort: number
  sponsored: number
}

function categoryLabel(slug: string, fromDb: Map<string, string>): string {
  if (!slug) return ''
  const stored = fromDb.get(slug)
  if (stored) return stored
  const hit = categories.find((category) => category.slug === slug)
  return hit?.name_zh || hit?.name_en || ''
}

/**
 * What the console row should say, given the switches the public pages read.
 *
 * `hidden` is `tool_overrides.hidden` — the kill switch behind 410 and the
 * list filter — so a listing the site has pulled is not shown as published
 * just because `dir_tool.status` still says approved. A live pin is featured
 * even when the static catalogue flag is off, which is how a submission gets
 * into the featured band.
 */
function applyPublicPlacement(row: AdminTool, state: OverrideState, day: string): AdminTool {
  const weight = state.sort[row.slug]
  return {
    ...row,
    featured: pinWindowActive(state.pinned[row.slug], day) || row.featured,
    // The public lists read the override weight, not `dir_tool.sort`. Showing
    // the stored column here would claim an order the site is not using.
    sort: typeof weight === 'number' ? weight : 0,
    status: placementStatus(row.status, state.hidden.includes(row.slug)),
  }
}

function submissionAdminRow(tool: Tool, categoryNames: Map<string, string>): AdminTool {
  return {
    id: tool.slug,
    slug: tool.slug,
    name: tool.name_en || tool.slug,
    tagline: tool.short_en || '',
    iconUrl: tool.logo || '',
    websiteUrl: tool.url || '',
    pricing: 'free',
    authorName: tool.maker || '',
    categoryId: tool.category || '',
    categoryName: categoryLabel(tool.category, categoryNames),
    source: 'community',
    featured: false,
    sponsored: false,
    sort: 0,
    status: 'published',
    createdAt: tool.created_at || '',
  }
}

/** Every console row, unpaged. Detail lookup must not stop at page size 100. */
async function allAdminToolRows(db: Db): Promise<AdminTool[]> {
  await ensureToolColumns(db)

  const [tools, extras, categoryRows, overrides] = await Promise.all([
    listDirectoryTools(db),
    db.prepare('SELECT slug, pricing, source, sort, sponsored FROM dir_tool').all<ToolExtraRow>(),
    db.prepare('SELECT slug, name FROM dir_category_tr WHERE locale = ?').bind('zh').all<{ slug: string; name: string }>(),
    loadOverrides(db),
  ])

  let submitted: Tool[] = []
  try {
    // Same predicate the homepage, /tools, the detail page and the sitemap use.
    // A failure here must not blank the editorial list.
    submitted = await listPublishedTools(db)
  } catch (err) {
    console.error('[admin/directory/tools] submissions unavailable', err)
  }

  const extraBySlug = new Map(extras.results.map((row) => [row.slug, row]))
  const categoryNames = new Map(categoryRows.results.map((row) => [row.slug, row.name]))

  const editorial: AdminTool[] = tools.map((tool) => {
    const extra = extraBySlug.get(tool.slug)
    return {
      id: tool.slug,
      slug: tool.slug,
      name: tool.name_en || tool.slug,
      tagline: tool.short_en || '',
      iconUrl: tool.logo || '',
      websiteUrl: tool.url || '',
      pricing: extra?.pricing || 'free',
      authorName: tool.maker || '',
      categoryId: tool.category || '',
      categoryName: categoryLabel(tool.category, categoryNames),
      source: extra?.source || 'editorial',
      featured: !!tool.is_featured,
      sponsored: !!extra?.sponsored,
      sort: Number(extra?.sort ?? 0),
      status: toConsoleStatus(tool.status),
      createdAt: tool.created_at || '',
    }
  })

  // Community listings first: the thirty presets already fill the first page,
  // which is why an approved submission was invisible until someone searched
  // a queue that this screen did not read.
  const communitySlugs = new Set<string>()
  const community: AdminTool[] = []
  for (const tool of submitted) {
    if (communitySlugs.has(tool.slug)) continue
    communitySlugs.add(tool.slug)
    community.push(submissionAdminRow(tool, categoryNames))
  }

  const day = today()
  return [...community, ...editorial.filter((row) => !communitySlugs.has(row.slug))].map((row) =>
    applyPublicPlacement(row, overrides, day),
  )
}

export async function listAdminTools(
  db: Db,
  params: { page?: number; pageSize?: number; search?: string; status?: string },
): Promise<{ items: AdminTool[]; total: number }> {
  const page = Math.max(1, Math.trunc(params.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.trunc(params.pageSize ?? 20)))
  const rows = await allAdminToolRows(db)

  const needle = (params.search ?? '').trim().toLowerCase()
  const wanted = params.status && params.status !== 'all' ? params.status : ''
  const filtered = rows.filter((row) => {
    if (wanted && row.status !== wanted) return false
    if (!needle) return true
    return (
      row.slug.toLowerCase().includes(needle) ||
      row.name.toLowerCase().includes(needle) ||
      row.tagline.toLowerCase().includes(needle) ||
      row.websiteUrl.toLowerCase().includes(needle)
    )
  })

  const offset = (page - 1) * pageSize
  return { items: filtered.slice(offset, offset + pageSize), total: filtered.length }
}

export interface AdminToolInput {
  slug: string
  name: string
  tagline: string
  introduction: string
  nameZh: string
  taglineZh: string
  introductionZh: string
  websiteUrl: string
  iconUrl: string
  pricing: string
  authorName: string
  categoryId: string
  source: string
  status: string
  featured: boolean
  sponsored: boolean
  sort: number
  tagIds: string[]
}

export async function updateAdminToolExtras(db: Db, slug: string, input: AdminToolInput) {
  await ensureToolColumns(db)
  await db
    .prepare('UPDATE dir_tool SET pricing = ?, source = ?, sort = ?, sponsored = ? WHERE slug = ?')
    .bind(input.pricing, input.source, input.sort, input.sponsored ? 1 : 0, slug)
    .run()
  return { slug }
}

/* ---------------------------------------------------------------------------
   tool detail / create / update / status / delete
--------------------------------------------------------------------------- */

export interface AdminToolDetail extends AdminTool {
  introduction: string
  nameZh: string
  taglineZh: string
  introductionZh: string
  tagIds: string[]
}

/** Tag label ↔ slug. `dir_tool.tags` stores English labels; the console edits slugs. */
async function tagLabelMap(db: Db): Promise<{ toSlug: Map<string, string>; toLabel: Map<string, string> }> {
  const rows = (
    await db.prepare("SELECT slug, name FROM dir_tag_tr WHERE locale = 'en'").all<{ slug: string; name: string }>()
  ).results
  const toSlug = new Map<string, string>()
  const toLabel = new Map<string, string>()
  for (const row of rows) {
    toSlug.set(row.name.toLowerCase(), row.slug)
    toLabel.set(row.slug, row.name)
  }
  return { toSlug, toLabel }
}

function submissionTagIds(raw: string): string[] {
  let labels: string[] = []
  try {
    const parsed = JSON.parse(raw || '[]')
    labels = Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    labels = []
  }
  return labels.map((label) => {
    const hit = catalogTags.find(
      (tag) => tag.slug === label || tag.name_en.toLowerCase() === label.toLowerCase(),
    )
    return hit?.slug ?? slugify(label)
  })
}

/** Submitted listings store one description; both locale boxes show it. */
function submissionDetail(base: AdminTool, row: SubmissionRow): AdminToolDetail {
  return {
    ...base,
    name: row.name,
    tagline: row.short,
    introduction: row.long_desc,
    nameZh: row.name,
    taglineZh: row.short,
    introductionZh: row.long_desc,
    tagIds: submissionTagIds(row.tags),
  }
}

function parseTagLabels(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export async function getAdminToolDetail(db: Db, slug: string): Promise<AdminToolDetail | null> {
  const clean = String(slug || '').trim()
  if (!clean) return null
  // The list endpoint caps a page at 100. Opening edit used to ask for that
  // page and then wait forever when the slug was not on it. Look up the full
  // in-memory list instead.
  const base = (await allAdminToolRows(db)).find((row) => row.slug === clean)
  if (!base) return null

  if (base.source === 'community') {
    const row = await db.prepare('SELECT * FROM submissions WHERE slug = ?').bind(clean).first<SubmissionRow>()
    if (row && publiclyListed(row)) return submissionDetail(base, row)
  }

  const trs = (
    await db
      .prepare('SELECT locale, name, short, long_desc FROM dir_tool_tr WHERE slug = ?')
      .bind(clean)
      .all<{ locale: string; name: string; short: string; long_desc: string }>()
  ).results
  const en = trs.find((row) => row.locale === 'en')
  const zh = trs.find((row) => row.locale === 'zh')

  const raw = await db.prepare('SELECT tags FROM dir_tool WHERE slug = ?').bind(clean).first<{ tags: string }>()
  const fallback = catalogTools.find((tool) => tool.slug === clean)
  const labels = parseTagLabels(raw?.tags)
  const tagSource = labels.length ? labels : (fallback?.tags ?? [])
  const { toSlug } = await tagLabelMap(db)

  return {
    ...base,
    introduction: en?.long_desc || fallback?.long_en || '',
    nameZh: zh?.name || fallback?.name_zh || base.name,
    taglineZh: zh?.short || fallback?.short_zh || base.tagline,
    introductionZh: zh?.long_desc || fallback?.long_zh || '',
    tagIds: tagSource.map((label) => toSlug.get(label.toLowerCase()) ?? slugify(label)),
  }
}

export interface AdminToolWrite extends AdminToolInput {
  createdAt?: string
}

export async function createAdminTool(db: Db, input: AdminToolWrite) {
  await ensureToolColumns(db)
  if (!input.name) throw new Error('name is required')

  const existing = await db.prepare('SELECT slug FROM dir_tool WHERE slug = ?').bind(input.slug).first<{ slug: string }>()
  if (existing) throw new Error('Slug already exists')

  const { toLabel } = await tagLabelMap(db)
  const tags = input.tagIds.map((id) => toLabel.get(id) ?? id)

  await saveToolHead(db, {
    slug: input.slug,
    name_en: input.name,
    name_zh: input.nameZh,
    short_en: input.tagline,
    short_zh: input.taglineZh,
    long_en: input.introduction,
    long_zh: input.introductionZh,
    url: input.websiteUrl,
    logo: input.iconUrl,
    category: input.categoryId,
    tags,
    status: toStoredStatus(input.status),
    is_featured: input.featured,
    is_paid: false,
    featured_until: '',
    votes_total: 0,
    votes_week: 0,
    created_at: input.createdAt || new Date().toISOString().slice(0, 10),
    maker: input.authorName,
    shots: [],
  })

  for (const locale of ['en', 'zh'] as const) {
    await saveToolTranslation(db, input.slug, locale, {
      name: locale === 'en' ? input.name : input.nameZh,
      short: locale === 'en' ? input.tagline : input.taglineZh,
      long_desc: locale === 'en' ? input.introduction : input.introductionZh,
      detail: {} as never,
    })
  }

  await updateAdminToolExtras(db, input.slug, input)
  return { slug: input.slug }
}

/**
 * Pin and recommend-weight, written to `tool_overrides`.
 *
 * That is the table the homepage, `/tools`, search and the sitemap already
 * read. `dir_tool.is_featured` / `dir_tool.sort` are not. An existing pin date
 * is kept when the listing stays featured, so saving the form does not turn
 * "pinned until Tuesday" into "pinned forever".
 */
async function syncPublicPlacement(db: Db, slug: string, featured: boolean, sort: number) {
  const existing = await db
    .prepare('SELECT pin, pin_until FROM tool_overrides WHERE slug = ?')
    .bind(slug)
    .first<{ pin: number; pin_until: string }>()
  const until = featured && existing?.pin && existing.pin_until ? existing.pin_until : ''
  await setOverride(db, slug, 'pin', featured, until)
  await setListingWeight(db, slug, sort)
}

export async function updateAdminTool(db: Db, slug: string, input: AdminToolInput) {
  await ensureToolColumns(db)
  if (!input.name) throw new Error('name is required')

  let current = await db
    .prepare('SELECT url, logo, category, tags, status, is_featured, is_paid, featured_until, votes_total, votes_week, created_at, maker, shots FROM dir_tool WHERE slug = ?')
    .bind(slug)
    .first<Record<string, unknown>>()
  if (!current) {
    // The thirty presets live in the catalogue until somebody edits one. The
    // detail page already prefers a database row, so the first save creates it
    // from the catalogue instead of refusing.
    const fallback = catalogTools.find((tool) => tool.slug === slug)
    if (!fallback) throw new Error('Tool not found')
    current = {
      url: fallback.url,
      logo: fallback.logo,
      category: fallback.category,
      tags: JSON.stringify(fallback.tags ?? []),
      status: fallback.status || 'approved',
      is_featured: fallback.is_featured ? 1 : 0,
      is_paid: fallback.is_paid ? 1 : 0,
      featured_until: fallback.featured_until || '',
      votes_total: fallback.votes_total || 0,
      votes_week: fallback.votes_week || 0,
      created_at: fallback.created_at || '',
      maker: fallback.maker || '',
      shots: JSON.stringify(fallback.shots ?? []),
    }
  }

  const { toLabel } = await tagLabelMap(db)
  const tags = input.tagIds.map((id) => toLabel.get(id) ?? id)

  // Source and status are locked after create (the list's actions own them), so
  // the edit payload omits both and the stored values are carried through.
  await saveToolHead(db, {
    slug,
    name_en: input.name,
    name_zh: input.nameZh,
    short_en: input.tagline,
    short_zh: input.taglineZh,
    long_en: input.introduction,
    long_zh: input.introductionZh,
    url: input.websiteUrl,
    logo: input.iconUrl,
    category: input.categoryId,
    tags,
    status: String(current.status ?? 'approved'),
    is_featured: input.featured,
    is_paid: !!current.is_paid,
    featured_until: String(current.featured_until ?? ''),
    votes_total: Number(current.votes_total ?? 0),
    votes_week: Number(current.votes_week ?? 0),
    created_at: String(current.created_at ?? ''),
    maker: input.authorName,
    shots: JSON.parse(String(current.shots ?? '[]')) as string[],
  })

  // `detail` (features / pros / cons / FAQ) is not part of this form, so the
  // stored document is read back and written unchanged — passing an empty one
  // here would silently erase the editorial sections on every save.
  const details = (
    await db.prepare('SELECT locale, detail FROM dir_tool_tr WHERE slug = ?').bind(slug).all<{ locale: string; detail: string }>()
  ).results

  for (const locale of ['en', 'zh'] as const) {
    const stored = details.find((row) => row.locale === locale)?.detail
    await saveToolTranslation(db, slug, locale, {
      name: locale === 'en' ? input.name : input.nameZh,
      short: locale === 'en' ? input.tagline : input.taglineZh,
      long_desc: locale === 'en' ? input.introduction : input.introductionZh,
      detail: stored ? (JSON.parse(stored) as never) : ({} as never),
    })
  }

  await updateAdminToolExtras(db, slug, input)
  await syncPublicPlacement(db, slug, input.featured, input.sort)
  return { slug }
}

/**
 * The edit drawer. Submitted products are written back to `submissions`, which
 * is what `/api/tools` and the detail page render. Presets stay on `dir_tool`.
 * Both also update the pin and the recommend weight, because those are the
 * fields the public lists actually sort and badge on.
 */
export async function saveAdminListing(db: Db, slug: string, input: AdminToolInput) {
  const row = await db.prepare('SELECT * FROM submissions WHERE slug = ?').bind(slug).first<SubmissionRow>()
  if (row && publiclyListed(row)) {
    await updateSubmissionCopy(db, row, input)
    const dir = await db.prepare('SELECT slug FROM dir_tool WHERE slug = ?').bind(slug).first<{ slug: string }>()
    if (dir) return updateAdminTool(db, slug, { ...input, source: 'community' })
    await syncPublicPlacement(db, slug, input.featured, input.sort)
    return { slug }
  }
  return updateAdminTool(db, slug, input)
}

async function updateSubmissionCopy(db: Db, row: SubmissionRow, input: AdminToolInput) {
  const name = pickListingText(input.name, input.nameZh, row.name, 60)
  if (!name) throw new Error('name is required')
  const short = pickListingText(input.tagline, input.taglineZh, row.short, 200)
  const longDesc = pickListingText(input.introduction, input.introductionZh, row.long_desc, 4000)
  const maker = input.authorName.replace(/<[^>]{0,200}>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)

  let url = row.url
  let domain = row.domain
  const nextUrl = input.websiteUrl.trim()
  if (nextUrl && nextUrl !== row.url) {
    let cleaned: [string, string]
    try {
      cleaned = cleanUrl(nextUrl)
    } catch {
      throw new Error('Website URL is invalid')
    }
    url = cleaned[0]
    domain = cleaned[1]
    if (domain !== row.domain) {
      const clash = await db
        .prepare(
          "SELECT id FROM submissions WHERE domain = ? AND id <> ? AND status IN ('pending','approved') LIMIT 1",
        )
        .bind(domain, row.id)
        .first<{ id: string }>()
      const takenByCatalog = catalogTools.some((tool) => domainOf(tool.url) === domain)
      if (clash || takenByCatalog) throw new Error('Another listing already uses this website')
    }
  }

  let logo = input.iconUrl.trim()
  if (logo && !/^https?:\/\//i.test(logo) && !logo.startsWith('/')) logo = row.logo

  const category = categories.some((item) => item.slug === input.categoryId) ? input.categoryId : row.category

  let tags = row.tags || '[]'
  if (input.tagIds.length) {
    const names: string[] = []
    for (const id of input.tagIds) {
      const hit = catalogTags.find((tag) => tag.slug === id || tag.name_en.toLowerCase() === id.toLowerCase())
      if (hit && !names.includes(hit.name_en)) names.push(hit.name_en)
      if (names.length >= 4) break
    }
    if (names.length) tags = JSON.stringify(names)
  }

  await db
    .prepare(
      `UPDATE submissions
       SET name = ?, short = ?, long_desc = ?, url = ?, domain = ?,
           logo = ?, maker = ?, category = ?, tags = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      name,
      short,
      longDesc,
      url,
      domain,
      logo,
      maker,
      category,
      tags,
      Math.floor(Date.now() / 1000),
      row.id,
    )
    .run()
}

export async function setAdminToolStatus(db: Db, slug: string, status: string) {
  const stored = toStoredStatus(status)
  // Hide and unhide go through `tool_overrides`. The public list, the detail
  // page (410) and the sitemap all read that flag; `dir_tool.status` does not
  // remove a catalogue entry or a submission from those surfaces.
  if (stored === 'approved') await setOverride(db, slug, 'hidden', false)
  else if (stored === 'rejected') await setOverride(db, slug, 'hidden', true)
  await db.prepare('UPDATE dir_tool SET status = ?, updated_at = ? WHERE slug = ?')
    .bind(stored, Math.floor(Date.now() / 1000), slug)
    .run()
  return { slug }
}

export async function deleteAdminTool(db: Db, slug: string) {
  const submitted = await db
    .prepare('SELECT id FROM submissions WHERE slug = ?')
    .bind(slug)
    .first<{ id: string }>()
  if (submitted) {
    throw new Error('Submitted listings stay in the review queue — hide them here, or reject them there')
  }
  const row = await db.prepare('SELECT status FROM dir_tool WHERE slug = ?').bind(slug).first<{ status: string }>()
  if (!row) throw new Error('Tool not found')
  if (toConsoleStatus(row.status) === 'published') {
    throw new Error('Only unpublished tools can be deleted — force unpublish first')
  }
  await db.prepare('DELETE FROM dir_collection_tool WHERE tool_slug = ?').bind(slug).run()
  await deleteDirectoryTool(db, slug)
  return { slug }
}

/* ---------------------------------------------------------------------------
   sponsor ads

   The source's ad is `directory_sponsor_ad`: a `tier` (silver / gold /
   platinum), a `status` (active / pending_payment / expired) and a datetime
   window. This build's `ads` table is the weekly-placement model the site
   actually sells — a `slot` (board / sidebar), an `active` kill switch and a
   `YYYY-MM-DD` window — so the console reads it through the same vocabulary the
   source page is written in:

     tier     ← `slot`          the inventory the ad occupies
     status   ← active + `end`  active / expired (this build has no billing, so
                                `pending_payment` never occurs)
     startsAt ← `start`         date-only, not a datetime
     endsAt   ← `end`

   The mapping is one-way and lives here, so the page above speaks only the
   source's words — exactly what `toConsoleStatus` does for tools.
--------------------------------------------------------------------------- */

export interface AdminAd {
  id: string
  name: string
  tagline: string
  url: string
  iconUrl: string
  tier: string
  status: string
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

/**
 * Console status from the kill switch and the window.
 *
 * A stopped ad and a finished window are both `expired`: the source only has one
 * word for "not on the site any more", and the difference between them is
 * whether the invoice ran its course — which the period column already shows.
 */
export function toAdStatus(row: { active: number; end: string }, day = today()): string {
  if (!row.active) return 'expired'
  if (row.end && row.end < day) return 'expired'
  return 'active'
}

export async function listAdminAds(
  db: Db,
  params: { page?: number; pageSize?: number; search?: string; status?: string },
): Promise<{ items: AdminAd[]; total: number }> {
  const page = Math.max(1, Math.trunc(params.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.trunc(params.pageSize ?? 20)))
  const day = today()

  // `listAds` already sorts newest-booking first, which is the source's
  // `orderBy(desc(createdAt))`.
  const rows = await listAds(db, 500)

  const mapped: AdminAd[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    tagline: row.headline || '',
    url: row.url,
    iconUrl: row.logo || '',
    tier: row.slot,
    status: toAdStatus(row, day),
    startsAt: row.start || null,
    endsAt: row.end || null,
    createdAt: new Date(row.created_at * 1000).toISOString(),
  }))

  const needle = (params.search ?? '').trim().toLowerCase()
  const wanted = params.status && params.status !== 'all' ? params.status : ''
  const filtered = mapped.filter((row) => {
    if (wanted && row.status !== wanted) return false
    if (!needle) return true
    return row.name.toLowerCase().includes(needle) || row.url.toLowerCase().includes(needle)
  })

  const offset = (page - 1) * pageSize
  return { items: filtered.slice(offset, offset + pageSize), total: filtered.length }
}

/**
 * Creative fields only.
 *
 * Tier, status and the window are inventory and billing facts, so the console
 * does not touch them — the source says the same and its form renders all four
 * read-only. Length rules live in the form (name and URL are required there);
 * the public submission path keeps its own validation in `ads.ts`.
 */
export async function updateAdminAd(
  db: Db,
  id: string,
  input: { name?: string; tagline?: string; url?: string; iconUrl?: string },
) {
  const row = await getAd(db, id)
  if (!row) throw new Error('Ad not found')

  const next = {
    name: input.name !== undefined ? input.name.trim() : row.name,
    headline: input.tagline !== undefined ? input.tagline.trim() : row.headline,
    url: input.url !== undefined ? input.url.trim() : row.url,
    logo: input.iconUrl !== undefined ? input.iconUrl.trim() : row.logo,
  }

  await db
    .prepare('UPDATE ads SET name = ?, headline = ?, url = ?, logo = ? WHERE id = ?')
    .bind(next.name, next.headline, next.url, next.logo, id)
    .run()

  return { id }
}

/**
 * Take an active placement down now.
 *
 * `stopAd` flips the kill switch and stamps `stopped_at` without rewriting the
 * window — the same separation the source keeps between `status` and
 * `startsAt`/`endsAt`, and the reason a taken-down campaign can still be
 * reconciled against its invoice.
 */
export async function forceExpireAdminAd(db: Db, id: string) {
  const row = await getAd(db, id)
  if (!row) throw new Error('Ad not found')
  if (toAdStatus(row) !== 'active') throw new Error('Only active ads can be force-expired')
  await stopAd(db, id)
  return { id }
}

/** Only a placement that is not live can be removed; take it down first. */
export async function deleteAdminAd(db: Db, id: string) {
  const row = await getAd(db, id)
  if (!row) throw new Error('Ad not found')
  if (toAdStatus(row) === 'active') {
    throw new Error('Active ads cannot be deleted — force take down first')
  }
  await db.prepare('DELETE FROM ads WHERE id = ?').bind(id).run()
  return { id }
}
