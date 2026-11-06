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
 * Two notes on the carried content, both deliberate:
 *
 *  - **The articles are the source's own.** They are about "ShipAny TanStack",
 *    not about this directory. They are carried over unedited because rewriting
 *    somebody's article is not a port. Replace or delete them once you decide
 *    what the blog should actually say.
 *  - **No `author_image`.** The source sets `/logo.png`, which does not exist in
 *    its own `public/` (it ships `logo.svg`) — so the avatar was already a dead
 *    reference there. The source renders no avatar when the field is absent, so
 *    leaving it out is the working version of the same intent.
 */

/** Register every local post slug here — it drives loading and the sitemap. */
export const BLOG_POST_SLUGS = ['what-is-shipany', 'blocks-vs-components'] as const

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

const LOCAL_META: Record<string, Record<string, BlogPostMeta>> = {
  'what-is-shipany': {
    en: {
      title: 'What is ShipAny TanStack',
      description:
        'ShipAny TanStack is a headless SaaS engine — auth, payments, subscriptions, credits, RBAC, and i18n pre-wired so you can focus on your product.',
      created_at: '2026-05-20',
      author_name: 'ShipAny Team',
    },
    zh: {
      title: '什么是 ShipAny TanStack',
      description:
        'ShipAny TanStack 是一个 Headless SaaS 引擎——认证、支付、订阅、积分、权限和国际化全部预置,让你专注于打造产品本身。',
      created_at: '2026-05-20',
      author_name: 'ShipAny 团队',
    },
  },
  'blocks-vs-components': {
    en: {
      title: 'Blocks vs Components: What Survives a Rebrand',
      description:
        'The core architectural split in ShipAny TanStack — disposable blocks read i18n and wire content, durable components render anything you feed them.',
      created_at: '2026-05-28',
      author_name: 'ShipAny Team',
    },
    zh: {
      title: 'Blocks 与 Components:改版后留下的是什么',
      description:
        'ShipAny TanStack 的核心架构切分——可抛弃的 block 读取文案并装配内容,耐用的 component 只渲染传入的 props。',
      created_at: '2026-05-28',
      author_name: 'ShipAny 团队',
    },
  },
}

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
