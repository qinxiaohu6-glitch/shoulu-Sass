/**
 * Article bodies for local blog posts.
 *
 * Bodies used to be inlined here because Nitro cannot load `?raw` markdown.
 * The old demo posts were removed. `loadLocalBody` returns null until a
 * real dirtool note is added. Old slugs 404 from the blog route.
 */

const BODIES: Record<string, Record<string, string>> = {}

const BASE_LOCALE = 'en'

/** Raw markdown for one post, falling back to the base locale. */
export function loadLocalBody(slug: string, locale: string): string | null {
  const entry = BODIES[slug]
  if (!entry) return null
  return entry[locale] ?? entry[BASE_LOCALE] ?? null
}
