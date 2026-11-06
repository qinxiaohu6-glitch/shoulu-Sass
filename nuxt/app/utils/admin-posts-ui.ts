/**
 * Source `routes/admin/-posts-shared.tsx` — the row shape, the form and the
 * page's constants.
 */

export interface AdminPost {
  id: string
  slug: string
  type: string
  title: string
  description: string | null
  image: string | null
  categories: string | null
  authorName: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface CategoryOption {
  id: string
  title: string
  slug: string
}

export const POSTS_PAGE_SIZE = 20
export const POST_TABS = ['all', 'published', 'draft'] as const
export type PostTab = (typeof POST_TABS)[number]

export interface PostForm {
  slug: string
  title: string
  description: string
  content: string
  categories: string
  authorName: string
  status: string
}

/** Source `emptyForm`. */
export function emptyPostForm(): PostForm {
  return { slug: '', title: '', description: '', content: '', categories: '', authorName: '', status: 'draft' }
}

/** Source `postSchema`: `slug` and `title` are required, everything else is not. */
export function isPostFormValid(form: PostForm) {
  return form.slug.trim().length > 0 && form.title.trim().length > 0
}

export function postStatusVariant(status: string) {
  if (status === 'published') return 'default' as const
  if (status === 'draft') return 'secondary' as const
  return 'outline' as const
}
