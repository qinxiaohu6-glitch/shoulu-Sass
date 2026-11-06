import type { Category, Collection, Tag } from '~~/shared/types/catalog'
import { categories as catalogCategories, tags as catalogTags } from '~~/shared/utils/catalog'

/**
 * The category / tag / collection lists, as the whole app sees them.
 *
 * Every card carries a category badge, every detail page a row of tag links and
 * every listing page a pill row, so this is read from more components than any
 * other piece of data in the app. It arrives once, from
 * `plugins/directory-meta.server.ts`, and then rides along in the SSR payload —
 * so `useDirectoryMeta()` is synchronous and costs no request, the same deal
 * `useOverrides()` gets.
 *
 * The arrays are returned as refs rather than plain values: a page that
 * resolves a name inside a `computed` has to re-run when the list changes, and
 * handing out `meta.value.categories` would freeze it at whatever was there on
 * first render.
 */
export interface DirectoryMeta {
  categories: Category[]
  tags: Tag[]
  collections: Collection[]
}

/** What the app shows before the server has spoken — and if it never does. */
export const FALLBACK_META: DirectoryMeta = {
  categories: catalogCategories,
  tags: catalogTags,
  collections: [],
}

export function useDirectoryMeta() {
  const meta = useState<DirectoryMeta>('directory-meta', () => FALLBACK_META)

  return {
    meta,
    categories: computed(() => meta.value.categories),
    tags: computed(() => meta.value.tags),
    collections: computed(() => meta.value.collections),
  }
}
