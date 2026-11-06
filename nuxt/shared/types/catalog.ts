export type Locale = 'en' | 'zh'

/* -------------------------------------------------------------------------
   Long-form detail blocks.

   The live stylesheet has carried `.steps`, `.feature-list`, `.pros-cons` and
   `.faq-list` since the static build, but no record ever supplied them with
   content — the rebuild dropped the sections rather than render empty shells.
   These types are the shape those styles were written for.

   Every field is optional and every array defaults to empty, so a listing with
   no editorial copy renders exactly the page it rendered before.
------------------------------------------------------------------------- */

export interface DetailItem {
  title: string
  desc: string
}

export interface DetailFaq {
  q: string
  a: string
}

export interface DetailBlock {
  how_to_use: string[]
  features: DetailItem[]
  use_cases: DetailItem[]
  pros: string[]
  cons: string[]
  faqs: DetailFaq[]
}

export type PartialDetail = Partial<DetailBlock>

export interface Tool {
  slug: string
  name_en: string
  name_zh: string
  short_en: string
  short_zh: string
  long_en: string
  long_zh: string
  url: string
  logo: string
  category: string
  tags: string[]
  status: string
  is_featured: boolean
  is_paid: boolean
  featured_until: string
  votes_total: number
  votes_week: number
  created_at: string
  maker: string
  shots: string[]
  /** Editorial sections. Absent on most records until the admin fills them. */
  detail_en?: PartialDetail
  detail_zh?: PartialDetail
}

export interface Category {
  slug: string
  icon: string
  count: number
  name_en: string
  name_zh: string
  desc_en: string
  desc_zh: string
  /** `deleted` marks a tombstone — only the admin console asks for those. */
  status?: string
  /** Display order in the console; public pages take the array order. */
  sort?: number
}

export interface Tag {
  slug: string
  count: number
  name_en: string
  name_zh: string
  /** Display order in the console; public pages sort by count. */
  sort?: number
}

/**
 * An editor-curated shortlist ("Best AI video tools", "Free tier worth using").
 *
 * Unlike a category, membership is explicit and ordered: `tools` is the
 * sequence the editor chose, not whatever the directory order happens to be.
 * A collection therefore carries its own `sort` for the index, and each member
 * carries its own position inside it.
 */
export interface Collection {
  slug: string
  icon: string
  cover: string
  sort: number
  status: string
  name_en: string
  name_zh: string
  desc_en: string
  desc_zh: string
  /** Tool slugs, in display order. */
  tools: string[]
}

export interface WeekRank {
  slug: string
  votes: number
}

export interface Week {
  id: string
  start: string
  end: string
  label_en: string
  label_zh: string
  ranking: WeekRank[]
}

export interface Site {
  name: string
  base: string
  dr: number
  dr_verified: boolean
}

export interface Catalog {
  site: Site
  generated: string
  categories: Category[]
  tags: Tag[]
  tools: Tool[]
  weeks: Week[]
}

/** A tool with its display strings already resolved to one language. */
export interface LocalizedTool extends Tool {
  name: string
  short: string
  long: string
  makerName: string
  makerSlug: string
  /** Never undefined — an unedited listing resolves to six empty arrays. */
  detail: DetailBlock
}

export interface Maker {
  slug: string
  name: string
  tools: LocalizedTool[]
  votes: number
}
