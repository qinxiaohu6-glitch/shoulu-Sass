<script setup lang="ts">
/**
 * /blog/:slug — ported from `shipany-dir/src/routes/blog/$slug.tsx`.
 *
 * Layout, section order and copy follow the source: back link, header with the
 * sponsored badge, date and author, optional lede and hero image, then the
 * article body, with a sponsor slot and "Recommended reading" in the right rail.
 *
 * What the source has that this build does not, and how each is handled:
 *
 *  - **Guest-post preview (`?preview=1`).** The source tries the preview
 *    endpoint first and falls through to the published post when it returns
 *    null. There is no guest-post store here, so the preview read is always
 *    null and the page falls through exactly as the source does — no banner, and
 *    a 404 for a slug that is not published.
 *  - **Database posts.** The source renders those as raw markdown; local posts
 *    render as bundled MDX components. This build has no posts table, so every
 *    post is local and goes through the same markdown renderer the source uses
 *    for database posts.
 */
import { getLocalPosts, loadLocalMeta, formatPostDate } from '~~/shared/content/blog'

const { lang, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()

const slug = computed(() => String(route.params.slug ?? ''))
const meta = computed(() => loadLocalMeta(slug.value, lang.value))

if (!meta.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found' })
}

const post = computed(() => {
  const m = meta.value
  if (!m) return null
  return {
    slug: slug.value,
    title: m.title,
    description: m.description,
    image: m.image,
    createdAt: new Date(m.created_at).toISOString(),
    authorName: m.author_name,
    authorImage: m.author_image,
    content: loadLocalBody(slug.value, lang.value) ?? '',
    sponsored: false,
  }
})

/** The source's `getBlogPostsFn({ limit: 6 })` minus the post being read. */
const recommendedPosts = computed(() =>
  getLocalPosts(lang.value).filter((p) => p.slug !== slug.value).slice(0, 6),
)

/**
 * Guest posts tag their outbound links with `utm_source=<this host>` so the
 * linked site can see where the traffic came from. The source reads the host
 * off `app_url`; here the request host is the same thing.
 *
 * Read once during setup rather than inside the computed: `useRequestURL` is a
 * Nuxt composable and needs the setup context, which a lazy getter no longer has.
 */
const siteHost = (() => {
  try {
    return useRequestURL().host
  } catch {
    return 'dirtool.com'
  }
})()

useSeo({
  title: computed(() =>
    post.value ? `${post.value.title} | Product Atlas` : 'Product Atlas',
  ),
  description: computed(() => post.value?.description ?? ''),
  type: 'article',
  image: post.value?.image,
})
</script>

<template>
  <div v-if="post" class="src-page mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <div class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article class="min-w-0">
        <NuxtLink
          :to="localePath('/blog')"
          class="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon name="arrow-left" :size="16" />
          {{ pick('返回博客', 'Back to blog') }}
        </NuxtLink>

        <header class="mt-8 mb-6 border-b border-border pb-6">
          <span
            v-if="post.sponsored"
            class="mb-3 inline-block rounded-full border border-border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase text-muted-foreground"
          >
            {{ pick('赞助内容', 'Sponsored') }}
          </span>
          <h1 class="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {{ post.title }}
          </h1>
          <div class="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span class="inline-flex items-center gap-1.5">
              <Icon name="calendar" :size="16" />
              {{ formatPostDate(post.createdAt, lang) }}
            </span>
            <span v-if="post.authorName || post.authorImage" class="inline-flex items-center gap-2">
              <img
                v-if="post.authorImage"
                :src="post.authorImage"
                :alt="post.authorName || ''"
                width="20"
                height="20"
                class="size-5 rounded-full object-cover"
              >
              {{ post.authorName }}
            </span>
          </div>
        </header>

        <p v-if="post.description" class="mb-6 text-muted-foreground">
          {{ post.description }}
        </p>

        <img
          v-if="post.image"
          :src="post.image"
          :alt="post.title"
          class="mb-8 w-full rounded-2xl border border-border object-cover"
        >

        <MarkdownContent
          :content="post.content"
          :sponsored="post.sponsored"
          :utm="post.sponsored ? { source: siteHost, medium: 'guest_post' } : undefined"        />
      </article>

      <aside class="space-y-3 self-start lg:sticky lg:top-[calc(var(--header-h,3.5rem)+1.5rem+var(--banner-h))] lg:pt-2">
        <SponsorAdsSlot placement="listing" :limit="4" />

        <section v-if="recommendedPosts.length > 0" class="pt-6">
          <p class="mb-2 text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            {{ pick('推荐阅读', 'Recommended reading') }}
          </p>
          <ul class="space-y-2">
            <li v-for="rec in recommendedPosts" :key="rec.slug">
              <NuxtLink
                :to="localePath(`/blog/${rec.slug}`)"
                class="block rounded-xl border border-border bg-card px-3 py-2.5 transition hover:border-primary/35"
              >
                <p class="line-clamp-2 text-sm font-semibold">{{ rec.title }}</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ formatPostDate(rec.createdAt, lang) }}
                </p>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>
