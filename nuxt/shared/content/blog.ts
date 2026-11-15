/**
 * Blog post metadata.
 *
 * Ported from `src/content/posts/index.ts`. Same contract, same file naming
 * (`<slug>.<locale>.md`, falling back to the base locale), same merge rule
 * against database posts.
 *
 * Two differences forced by the build:
 *
 *  - **Markdown, not MDX.** The source stores posts as MDX and renders them
 *    through React components. There is no MDX pipeline here, and the two posts
 *    use nothing but plain markdown plus a fenced code block, so they are
 *    carried as `.md` and rendered by `app/utils/markdown.ts`.
 *  - **Bodies live in `app/utils/blogBodies.ts`.** This module is imported by
 *    `server/routes/sitemap.xml.ts`, and Nitro does not run Vite's `?raw`
 *    loader — so only the metadata that the sitemap needs stays here.
 *
 * The two ShipAny demo posts were removed. The blog stays up as an empty
 * state until a real Product Atlas note is written. Old slugs 404.
 */

/** Register every local post slug here — it drives loading and the sitemap. */
export const BLOG_POST_SLUGS = [] as const

export type BlogPostMeta = {
  title: string
  description: string
  created_at: string
  author_name?: string
  author_image?: string
  image?: string
}

export type BlogPost = {
  slug: string
  title: string
  description: string
  image?: string
  /** ISO date string — serializable across the loader boundary. */
  createdAt: string
  authorName?: string
  authorImage?: string
  source: 'local' | 'db'
  /** A paid guest post: shown with a Sponsored label, links rel="sponsored". */
  sponsored?: boolean
}

const LOCAL_META: Record<string, Record<string, BlogPostMeta>> = {}

const BASE_LOCALE = 'en'

export function loadLocalMeta(slug: string, locale: string): BlogPostMeta | null {
  const entry = LOCAL_META[slug]
  if (!entry) return null
  return entry[locale] ?? entry[BASE_LOCALE] ?? null
}

function localPostToItem(slug: string, meta: BlogPostMeta): BlogPost {
  return {
    slug,
    title: meta.title,
    description: meta.description,
    image: meta.image,
    createdAt: new Date(meta.created_at).toISOString(),
    authorName: meta.author_name,
    authorImage: meta.author_image,
    source: 'local',
  }
}

export function getLocalPosts(locale: string): BlogPost[] {
  return BLOG_POST_SLUGS.map((slug) => ({ slug, meta: loadLocalMeta(slug, locale) }))
    .filter((m): m is { slug: string; meta: BlogPostMeta } => m.meta !== null)
    .map(({ slug, meta }) => localPostToItem(slug, meta))
}

/**
 * Merge database posts with local posts, deduped by slug (database wins),
 * newest first.
 */
export function mergePosts(
  dbPosts: BlogPost[],
  localPosts: BlogPost[],
  options: { limit?: number } = {},
): BlogPost[] {
  const dbSlugs = new Set(dbPosts.map((p) => p.slug))
  const merged = [...dbPosts, ...localPosts.filter((p) => !dbSlugs.has(p.slug))].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  return options.limit ? merged.slice(0, options.limit) : merged
}

export function formatPostDate(dateIso: string, locale: string): string {
  // Pass the UI locale straight to Intl so a new language works without a
  // zh/en branch here.
  return new Intl.DateTimeFormat(locale || 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateIso))
}
