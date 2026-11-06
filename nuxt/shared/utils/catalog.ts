import raw from '~~/shared/content/catalog.json'
import type {
  Catalog,
  Category,
  Collection,
  DetailBlock,
  LocalizedTool,
  Locale,
  Maker,
  Site,
  Tag,
  Tool,
  Week,
} from '~~/shared/types/catalog'

const catalog = raw as unknown as Catalog

export const site: Site = catalog.site
export const categories: Category[] = catalog.categories
export const tags: Tag[] = catalog.tags
export const tools: Tool[] = catalog.tools
export const weeks: Week[] = catalog.weeks

/* -------------------------------------------------------------------------
   localized field access
   Every record carries `name_en` / `name_zh` style pairs, so the language
   switch never touches the data itself.
------------------------------------------------------------------------- */

function field(record: Record<string, unknown>, base: string, locale: Locale): string {
  const value = record[`${base}_${locale}`]
  if (typeof value === 'string' && value) return value
  const fallback = record[`${base}_en`]
  return typeof fallback === 'string' ? fallback : ''
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The URL segment a maker lives at.
 *
 * `slugify` keeps only `[a-z0-9]`, so a non-Latin name ("张伟") reduces to
 * nothing — and a maker with no slug has no page. The name is what the page
 * renders and what search engines index; the slug only has to be stable, so a
 * plain code-point hash stands in. It is deterministic across builds, which is
 * what a URL needs to be.
 */
export function makerSlugOf(name: string): string {
  const raw = String(name || '').trim()
  if (!raw) return ''
  const base = slugify(raw)
  if (base) return base
  let hash = 0
  for (const ch of raw) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return `maker-${hash.toString(16).padStart(8, '0')}`
}

/**
 * Editorial sections for one language.
 *
 * Falls back to the English block when a translation is missing, and fills in
 * every missing array. Both matter: the detail page decides which sections to
 * render by checking `length`, so a `undefined` slipping through would crash
 * the template instead of quietly hiding one section.
 */
export function detailFor(tool: Tool, locale: Locale): DetailBlock {
  const block = (locale === 'zh' ? tool.detail_zh : tool.detail_en) ?? tool.detail_en
  return {
    how_to_use: block?.how_to_use ?? [],
    features: block?.features ?? [],
    use_cases: block?.use_cases ?? [],
    pros: block?.pros ?? [],
    cons: block?.cons ?? [],
    faqs: block?.faqs ?? [],
  }
}

export function localizeTool(tool: Tool, locale: Locale): LocalizedTool {
  return {
    ...tool,
    name: field(tool as unknown as Record<string, unknown>, 'name', locale),
    short: field(tool as unknown as Record<string, unknown>, 'short', locale),
    long: field(tool as unknown as Record<string, unknown>, 'long', locale),
    makerName: tool.maker,
    makerSlug: makerSlugOf(tool.maker),
    detail: detailFor(tool, locale),
  }
}

export function localizeCategory(category: Category, locale: Locale) {
  return {
    ...category,
    name: field(category as unknown as Record<string, unknown>, 'name', locale),
    desc: field(category as unknown as Record<string, unknown>, 'desc', locale),
  }
}

export function localizeTag(tag: Tag, locale: Locale) {
  return {
    ...tag,
    name: field(tag as unknown as Record<string, unknown>, 'name', locale),
  }
}

/**
 * Collections carry the same `_en` / `_zh` pair as categories, but they have no
 * catalogue to fall back to — a collection only exists because an operator
 * made one, so a missing translation stays missing rather than borrowing a
 * word from somewhere else.
 */
export function localizeCollection(collection: Collection, locale: Locale) {
  return {
    ...collection,
    name: field(collection as unknown as Record<string, unknown>, 'name', locale),
    desc: field(collection as unknown as Record<string, unknown>, 'desc', locale),
  }
}

/**
 * Tools store tags by their English name ("Agent", "Chatbot"), so a badge has
 * to be looked up against the tag list to render 智能体 / 聊天机器人 on the zh
 * pages. Unknown values fall through unchanged.
 *
 * `list` defaults to the catalogue for the same reason the lookups above do —
 * server-side callers have no Nuxt context to read the live list from.
 */
export function tagLabel(tag: string, locale: Locale, list: Tag[] = tags): string {
  const hit = list.find((t) => t.slug === slugify(tag))
  return hit ? field(hit as unknown as Record<string, unknown>, 'name', locale) : tag
}

/* -------------------------------------------------------------------------
   ordering — mirrors the original build: paid first, then featured, then the
   rest, each group keeping the catalogue's own sequence.

   This is a *stable* sort on two flags, not a vote ranking. Sorting the
   leftovers by votes_total instead produced a visibly different listing page:
   the live order runs ChatGPT, Claude, Cursor, Runway… while a vote sort puts
   ElevenLabs and Runway ahead of Claude.
------------------------------------------------------------------------- */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/* -------------------------------------------------------------------------
   operator overrides — pin / hide

   Two switches the admin panel can throw without editing the build-time
   catalogue: `pin` promotes a listing to the featured block until a date, and
   `hidden` pulls one out of every list and makes its own page answer 410.

   They arrive as one small object (see /api/overrides) and every listing
   helper below takes it as an optional last argument. Omitting it is the
   empty state, so a caller that has not been taught about the panel behaves
   exactly as it did before the panel existed.
------------------------------------------------------------------------- */

export type OverrideView = {
  /** slug → last day the pin applies; `''` means "until switched off". */
  pinned: Record<string, string>
  hidden: string[]
}

export const NO_OVERRIDES: OverrideView = { pinned: {}, hidden: [] }

/** A pin set by an operator, still inside its window. */
function pinActive(tool: Tool, today: string, overrides: OverrideView): boolean {
  const until = overrides.pinned[tool.slug]
  if (until === undefined) return false
  return !until || until >= today
}

/**
 * Named `isHiddenTool`, not `isHidden`: `server/utils/overrides.ts` exports a
 * database-backed `isHidden(db, slug)` and the two auto-import namespaces
 * collide. A silent pick of the wrong one would be a very quiet bug.
 */
export function isHiddenTool(tool: Tool, overrides: OverrideView = NO_OVERRIDES): boolean {
  return overrides.hidden.includes(tool.slug)
}

/** Paid or featured and the window has not closed yet — or pinned by hand. */
export function isPinned(
  tool: Tool,
  today = todayISO(),
  overrides: OverrideView = NO_OVERRIDES,
): boolean {
  if (pinActive(tool, today, overrides)) return true
  if (!(tool.is_paid || tool.is_featured)) return false
  return Boolean(tool.featured_until) && tool.featured_until >= today
}

/**
 * Paid → featured → the rest. An operator pin counts as featured for ordering
 * purposes, so a hand-promoted listing sits in the featured block rather than
 * merely wearing a badge at the bottom of the page.
 */
function rankOf(tool: Tool, today: string, overrides: OverrideView): number {
  if (tool.is_paid) return 0
  if (tool.is_featured || pinActive(tool, today, overrides)) return 1
  return 2
}

export function orderedTools(
  locale: Locale,
  overrides: OverrideView = NO_OVERRIDES,
  today = todayISO(),
): LocalizedTool[] {
  return tools
    .filter((tool) => !isHiddenTool(tool, overrides))
    .map((tool, index) => ({ tool, index }))
    .sort(
      (a, b) =>
        rankOf(a.tool, today, overrides) - rankOf(b.tool, today, overrides) || a.index - b.index,
    )
    .map(({ tool }) => localizeTool(tool, locale))
}

export function featuredTools(
  locale: Locale,
  overrides: OverrideView = NO_OVERRIDES,
  today = todayISO(),
): LocalizedTool[] {
  return orderedTools(locale, overrides, today).filter(
    (tool) => isPinned(tool, today, overrides) || tool.is_featured,
  )
}

/**
 * The directory, with community submissions folded in.
 *
 * Same rule the static list uses — paid first, then featured, then the rest —
 * so a paid submission lands where it was sold, not at the bottom. `sort` is
 * stable, so within a rank the catalogue keeps its own sequence and the
 * submissions keep their newest-first order behind it.
 *
 * Returns `catalog` untouched when there is nothing to merge, which is what
 * keeps every page byte-identical while the directory has no submissions.
 */
export function mergeDirectory(
  catalog: LocalizedTool[],
  submitted: LocalizedTool[],
  overrides: OverrideView = NO_OVERRIDES,
  today = todayISO(),
): LocalizedTool[] {
  // Filtering only when something is actually hidden keeps the empty case
  // returning the very same array, which is what makes the no-override pages
  // byte-identical to the pre-panel build.
  const base = overrides.hidden.length
    ? catalog.filter((tool) => !isHiddenTool(tool, overrides))
    : catalog
  const visible = overrides.hidden.length
    ? submitted.filter((tool) => !isHiddenTool(tool, overrides))
    : submitted
  if (!visible.length) return base
  return [...base, ...visible].sort(
    (a, b) => rankOf(a, today, overrides) - rankOf(b, today, overrides),
  )
}

export function latestTools(
  locale: Locale,
  limit = 6,
  overrides: OverrideView = NO_OVERRIDES,
): LocalizedTool[] {
  return [...tools]
    .filter((tool) => !isHiddenTool(tool, overrides))
    .map((tool) => localizeTool(tool, locale))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit)
}

export function toolBySlug(slug: string, locale: Locale): LocalizedTool | undefined {
  const hit = tools.find((tool) => tool.slug === slug)
  return hit ? localizeTool(hit, locale) : undefined
}

export function toolsByCategory(
  categorySlug: string,
  locale: Locale,
  overrides: OverrideView = NO_OVERRIDES,
): LocalizedTool[] {
  return orderedTools(locale, overrides).filter((tool) => tool.category === categorySlug)
}

/**
 * Tag pages are the one listing that ranks by votes instead of directory order:
 * /tags/api.html runs Claude 188, Gemini 152, Ollama 150, DeepSeek 136 — not
 * the paid/featured-first sequence the category pages use.
 */
export function toolsByTag(
  tagSlug: string,
  locale: Locale,
  overrides: OverrideView = NO_OVERRIDES,
): LocalizedTool[] {
  return orderedTools(locale, overrides)
    .filter((tool) => tool.tags.some((tag) => slugify(tag) === tagSlug))
    .sort((a, b) => b.votes_week - a.votes_week)
}

/**
 * `list` defaults to the catalogue, so every existing caller keeps working —
 * including the server-side ones, which have no Nuxt context to read the
 * database-backed list from. Pages that must reflect an operator's edit pass
 * the live list in from `useDirectoryMeta()`.
 */
export function categoryBySlug(slug: string, list: Category[] = categories) {
  return list.find((category) => category.slug === slug)
}

export function tagBySlug(slug: string, list: Tag[] = tags) {
  return list.find((tag) => tag.slug === slug)
}

/**
 * The category pill row is not in catalog order on the live site — Developer
 * Tools leads, and Productivity/Research come before Writing. Keeping the same
 * sequence so the row reads identically on every page that shows it.
 */
export const PILL_ORDER = [
  'coding',
  'chatbots',
  'image',
  'video',
  'audio',
  'productivity',
  'research',
  'writing',
]

export function pillCategories(locale: Locale, list: Category[] = categories) {
  return PILL_ORDER
    .map((slug) => categoryBySlug(slug, list))
    .filter((c): c is Category => Boolean(c))
    .map((c) => localizeCategory(c, locale))
}

/* -------------------------------------------------------------------------
   makers — derived from the tools, same rule the static build used
------------------------------------------------------------------------- */

/**
 * The live makers index runs Anthropic, Consensus, Perplexity, Replit, Jasper AI…
 * which is neither the catalogue order nor a vote_total ranking — it is the
 * directory order (paid → featured → catalogue) stably re-sorted by this week's
 * votes. That tie-break matters: Notion and StackBlitz are both on 116, and the
 * live index puts Notion first only because Notion is a paid listing.
 *
 * `extra` is the community listings, which live in the database rather than the
 * static import. They merge into the same ranking, and because a maker is keyed
 * by slug, a maker who submits a second product lands on the page they already
 * have instead of a duplicate.
 */
export function allMakers(
  locale: Locale,
  extra: LocalizedTool[] = [],
  overrides: OverrideView = NO_OVERRIDES,
): Maker[] {
  const ranked = mergeDirectory(orderedTools(locale, overrides), extra, overrides).sort(
    (a, b) => b.votes_week - a.votes_week,
  )

  const bucket = new Map<string, Maker>()
  for (const tool of ranked) {
    // A listing with no maker name has nobody to attribute it to, and an empty
    // slug would produce a `/makers/` link back to the index.
    if (!tool.makerSlug) continue
    const key = tool.makerSlug
    if (!bucket.has(key)) {
      bucket.set(key, { slug: key, name: tool.makerName, tools: [], votes: 0 })
    }
    const maker = bucket.get(key)!
    maker.tools.push(tool)
    maker.votes += tool.votes_total
  }
  return [...bucket.values()]
}

/** Avatar tint, same formula the static build used: (sum of code points × 37) % 360. */
export function makerHue(name: string): number {
  let sum = 0
  for (const ch of name) sum += ch.codePointAt(0) ?? 0
  return (sum * 37) % 360
}

export function makerInitial(name: string): string {
  return (name[0] || '?').toUpperCase()
}

/** Categories a maker ships in, first-seen order, localized. */
export function makerCategories(maker: Maker, locale: Locale, list: Category[] = categories) {
  const seen = new Set<string>()
  const out: ReturnType<typeof localizeCategory>[] = []
  for (const tool of maker.tools) {
    if (seen.has(tool.category)) continue
    seen.add(tool.category)
    const cat = categoryBySlug(tool.category, list)
    if (cat) out.push(localizeCategory(cat, locale))
  }
  return out
}

export function makerBySlug(
  slug: string,
  locale: Locale,
  extra: LocalizedTool[] = [],
  overrides: OverrideView = NO_OVERRIDES,
): Maker | undefined {
  return allMakers(locale, extra, overrides).find((maker) => maker.slug === slug)
}

/* -------------------------------------------------------------------------
   weekly board — ISO week (Monday based), same format as votes.week_id()
------------------------------------------------------------------------- */

export function isoWeekId(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function weekById(id: string): Week | undefined {
  return weeks.find((week) => week.id === id)
}

/** The archived week that matches today, if one exists. */
export function currentWeek(): Week | undefined {
  return weekById(isoWeekId())
}

export function weekLabel(week: Week | undefined, locale: Locale): string {
  if (week) return locale === 'zh' ? week.label_zh : week.label_en
  const now = new Date()
  const monday = new Date(now)
  const day = monday.getDay() || 7
  monday.setDate(monday.getDate() - (day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}`
  return locale === 'zh'
    ? `${monday.getFullYear()} 年 ${fmt(monday)} – ${fmt(sunday)}`
    : `${monday.toLocaleString('en-US', { month: 'short' })} ${monday.getDate()} – ${sunday.toLocaleString('en-US', { month: 'short' })} ${sunday.getDate()}, ${sunday.getFullYear()}`
}

/** Board rows for a week, falling back to live vote totals for the current one. */
export function boardRows(week: Week | undefined, locale: Locale, limit = 10) {
  // An archived week already carries its final order. The current week has no
  // archive row yet, so it has to be ranked by this week's votes — using
  // orderedTools() here would show the directory order under a heading that
  // says "ranked by votes this week".
  const source = week
    ? week.ranking.map((row) => ({ slug: row.slug, votes: row.votes }))
    : [...tools]
        .map((tool) => ({ slug: tool.slug, votes: tool.votes_week }))
        .sort((a, b) => b.votes - a.votes)

  return source.slice(0, limit).map((row, index) => ({
    rank: index + 1,
    votes: row.votes,
    tool: toolBySlug(row.slug, locale),
  }))
}
