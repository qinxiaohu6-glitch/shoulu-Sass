/**
 * Source `routes/admin/directory/-tools-shared.tsx` — the value shape, the five
 * tabs, the empty form and the two payload builders.
 *
 * Kept out of the page because the page and the field set both read them, the
 * same split the source makes into `-tools-shared.tsx`.
 */

/** Source `TABS`. `all` means "no status filter". */
export const TOOL_TABS = ['all', 'published', 'pending', 'pending_payment', 'rejected'] as const
export type ToolTab = (typeof TOOL_TABS)[number]

export const PAGE_SIZE = 20

/** One row of `GET /api/admin/directory/tools` — the source's `DirTool`. */
export interface DirTool {
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

/** The source's `Option` — the shape both `?all=true` endpoints answer with. */
export interface DirOption {
  id: string
  slug: string
  name: string
}

export interface ToolFormValues {
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
  sort: string
  tagIds: string[]
}

/** Source `emptyForm` — a new listing is published, free, editorial, sort 0. */
export function emptyToolForm(): ToolFormValues {
  return {
    slug: '',
    name: '',
    tagline: '',
    introduction: '',
    nameZh: '',
    taglineZh: '',
    introductionZh: '',
    websiteUrl: '',
    iconUrl: '',
    pricing: 'free',
    authorName: '',
    categoryId: '',
    source: 'editorial',
    status: 'published',
    featured: false,
    sponsored: false,
    sort: '0',
    tagIds: [],
  }
}

/**
 * Source `valuesFromToolDetail`. The detail endpoint answers the same shape as a
 * row plus the four translated columns and `tagIds`, so the edit drawer hydrates
 * on first mount instead of filling in after the user starts typing.
 */
export function valuesFromToolDetail(detail: Partial<ToolFormValues> & { sort?: string | number }): ToolFormValues {
  return {
    slug: detail.slug || '',
    name: detail.name || '',
    tagline: detail.tagline || '',
    introduction: detail.introduction || '',
    nameZh: detail.nameZh || '',
    taglineZh: detail.taglineZh || '',
    introductionZh: detail.introductionZh || '',
    websiteUrl: detail.websiteUrl || '',
    iconUrl: detail.iconUrl || '',
    pricing: detail.pricing || 'free',
    authorName: detail.authorName || '',
    categoryId: detail.categoryId || '',
    source: detail.source || 'editorial',
    status: detail.status || 'published',
    featured: Boolean(detail.featured),
    sponsored: Boolean(detail.sponsored),
    sort: String(detail.sort ?? 0),
    tagIds: detail.tagIds ? [...detail.tagIds] : [],
  }
}

/**
 * Source `toPayload`.
 *
 * The optional text columns are sent even when empty: `JSON.stringify` drops
 * `undefined`, so omitting them would leave the previous value in the database
 * after the operator cleared the field.
 */
export function toToolPayload(value: ToolFormValues) {
  return {
    slug: value.slug.trim() || undefined,
    name: value.name.trim(),
    tagline: value.tagline.trim(),
    introduction: value.introduction.trim(),
    nameZh: value.nameZh.trim(),
    taglineZh: value.taglineZh.trim(),
    introductionZh: value.introductionZh.trim(),
    websiteUrl: value.websiteUrl.trim(),
    iconUrl: value.iconUrl.trim(),
    pricing: value.pricing || 'free',
    authorName: value.authorName.trim(),
    categoryId: value.categoryId || '',
    source: value.source === 'community' ? 'community' : 'editorial',
    status: value.status || 'published',
    featured: value.featured,
    sponsored: value.sponsored,
    sort: Number(value.sort) || 0,
    tagIds: value.tagIds,
  }
}

/** Source `toEditPayload` — slug, source and status stay locked after create. */
export function toToolEditPayload(value: ToolFormValues) {
  const { slug: _slug, source: _source, status: _status, ...rest } = toToolPayload(value)
  return rest
}

/** Source `canDeleteTool` — a published listing has to be force-unpublished first. */
export function canDeleteTool(status: string) {
  return status !== 'published'
}

export function canForceUnpublishTool(status: string) {
  return status === 'published'
}

/**
 * Source `lib/directory/favicon-url.ts` — the list thumb falls back to the
 * site's favicon when a listing carries no logo of its own.
 */
export function faviconUrlForWebsite(websiteUrl: string): string {
  try {
    const host = new URL(websiteUrl).hostname
    if (!host) return ''
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`
  } catch {
    return ''
  }
}
