<script setup lang="ts">
/**
 * /products/:slug — product detail. /tools/:slug (except dr-checker) redirects here.
 *
 * Two columns: the tool itself on the left (header, outbound button, metadata,
 * tags, collections, screenshot gallery, sticky section nav, long-form sections)
 * and a sticky rail on the right (sponsor slot + popular tools), then "More in
 * {category}" underneath.
 *
 * Data loading is unchanged from this build's earlier version — `/api/directory/:slug`
 * answers from D1 when an operator has edited the listing, from the catalogue
 * otherwise, and from `submission` for community entries; a pulled listing is 410,
 * a missing one 404. Only the presentation is the source's.
 *
 * Mapping, source → here:
 *
 *   `iconUrl`        `logo`            (resolved by `ToolLogo`)
 *   `tagline`        `short`
 *   `introduction`   `long`
 *   `howToUse`       `detail.how_to_use` (already an array)
 *   `features`       `detail.features`   (`desc`, not `description`)
 *   `useCases`       `detail.use_cases`
 *   `pros`/`cons`    `detail.pros` / `detail.cons`
 *   `faqs`           `detail.faqs`       (`q`/`a`, not `question`/`answer`)
 *   `screenshots`    `shots`             (bare names under `assets/img/screenshots`)
 *   `categoryName`   resolved from the live category list by slug
 *   `authorName`     `makerName`
 *   `publishedAt`    `created_at`
 *   `related`        same-category tools, in directory order
 *
 * The source also renders a preview banner for unpublished submissions
 * (`?preview=1`). This build has no preview endpoint — the submission's own page
 * lives in Settings → My submissions — so the banner is not ported.
 */
import type { SectionTabItem } from '~/utils/directory-ui'
import type { Tool } from '~~/shared/types/catalog'

const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const t = useDirectoryCopy()

const slug = computed(() => String(route.params.slug || ''))
const overrides = useOverrides()
const { categories: liveCategories, collections } = useDirectoryMeta()

/**
 * `useRequestFetch`, not the global `$fetch`: a relative path needs an origin,
 * and under Cloudflare Workers there is no ambient one. `useRequestFetch` binds
 * the call to the incoming request, so it is dispatched internally and carries
 * cookies.
 */
const requestFetch = useRequestFetch()

/**
 * The operator's kill switch, checked before anything else.
 *
 * A pulled listing answers 410 rather than 404. 404 says "never existed", which
 * invites a crawler to keep probing; 410 says "it was here and it is not coming
 * back". It is also checked before the database call, so a hidden page costs
 * nothing to serve.
 */
if (overrides.value.hidden.includes(slug.value)) {
  throw createError({
    statusCode: 410,
    statusMessage: isZh.value ? '这个产品已下架' : 'This listing has been removed',
    fatal: true,
  })
}

type DirectoryPayload = {
  ok: boolean
  tool?: Tool
  source?: 'db' | 'catalog' | 'submission'
  reason?: string
}

const { data: payload, error: loadError } = await useAsyncData<DirectoryPayload>(
  () => `tool:${slug.value}`,
  async () => {
    try {
      return await requestFetch<DirectoryPayload>(
        `/api/directory/${encodeURIComponent(slug.value)}`,
      )
    } catch (err) {
      // 404 / 410 are answers, not failures: the endpoint has already decided the
      // listing is gone. Anything else (a D1 blink, a Worker 5xx) must surface as
      // a 500 — answering 404 would tell Google to drop a live page.
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 404) return { ok: false, reason: 'not_found' }
      if (status === 410) return { ok: false, reason: 'removed' }
      throw err
    }
  },
  { watch: [slug] },
)

if (loadError.value) {
  throw createError({
    statusCode: 500,
    statusMessage: isZh.value ? '暂时无法加载这个页面' : 'This page is temporarily unavailable',
    fatal: true,
  })
}

if (payload.value && !payload.value.ok) {
  const removed = payload.value.reason === 'removed'
  throw createError({
    statusCode: removed ? 410 : 404,
    statusMessage: removed
      ? isZh.value ? '这个产品已下架' : 'This listing has been removed'
      : isZh.value ? '没有这个产品' : 'No such product',
    fatal: true,
  })
}

const tool = computed(() =>
  payload.value?.tool ? localizeTool(payload.value.tool, lang.value) : null,
)

if (!tool.value) {
  throw createError({
    statusCode: 404,
    statusMessage: isZh.value ? '没有这个产品' : 'No such product',
    fatal: true,
  })
}

const category = computed(() => {
  const hit = categoryBySlug(tool.value!.category, liveCategories.value)
  return hit ? localizeCategory(hit, lang.value) : undefined
})

/** Curated lists this listing appears in — the source's `tool.collections`. */
const inCollections = computed(() =>
  collections.value
    .filter((collection) => collection.tools.includes(tool.value!.slug))
    .map((collection) => localizeCollection(collection, lang.value)),
)

/** Tag links go back to the listing filter, which is where the source sends them. */
const tagLinks = computed(() =>
  tool.value!.tags.map((name) => ({ slug: slugify(name), name: tagLabel(name, lang.value) })),
)

/** The source's `related`: the rest of the category, in directory order. */
const related = computed(() =>
  orderedTools(lang.value, overrides.value)
    .filter((entry) => entry.slug !== tool.value!.slug && entry.category === tool.value!.category)
    .slice(0, 3),
)

/* "Popular tools" in the rail — the same five the homepage board shows. */
const topPicks = computed(() =>
  boardRows(
    weeks.length ? [...weeks].sort((a, b) => (a.id < b.id ? 1 : -1))[0] : undefined,
    lang.value,
    6,
    overrides.value,
  )
    .map((row) => row.tool)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .filter((entry) => entry.slug !== tool.value!.slug)
    .slice(0, 5),
)

/**
 * The curated catalogue stores bare filenames under `/assets/img/screenshots`.
 * Operator-written submissions may instead carry an absolute image URL (an
 * operator reviewing a listing cannot deploy a new asset for every screenshot),
 * so an `http(s)` value is used as-is. Nothing else is rewritten — the gallery
 * receives either a local asset path or a real URL.
 */
const shots = computed(() =>
  tool.value!.shots.map((name) =>
    /^https?:\/\//i.test(name) ? name : `/assets/img/screenshots/${name}`,
  ),
)

const listedOn = computed(() => tool.value!.created_at.slice(0, 10))

/** The section nav is built from what actually rendered, never from a fixed list. */
const sectionTabs = computed<SectionTabItem[]>(() => {
  const detail = tool.value!.detail
  const tabs: SectionTabItem[] = []
  if (tool.value!.long) tabs.push({ id: 'what-is', label: t('directory.detail.tab_overview') })
  if (detail.how_to_use.length)
    tabs.push({ id: 'how-to-use', label: t('directory.detail.tab_how_to_use') })
  if (detail.features.length)
    tabs.push({ id: 'features', label: t('directory.detail.tab_features') })
  if (detail.use_cases.length)
    tabs.push({ id: 'use-cases', label: t('directory.detail.tab_use_cases') })
  if (detail.pros.length || detail.cons.length)
    tabs.push({ id: 'pros-cons', label: t('directory.detail.tab_pros_cons') })
  if (detail.faqs.length) tabs.push({ id: 'faq', label: t('directory.detail.tab_faq') })
  return tabs
})

const openFaq = ref<number | null>(null)

const canonicalPath = computed(
  () => `https://dirtool.com${isZh.value ? '/zh' : ''}/products/${slug.value}`,
)

useSeo({
  title: computed(() =>
    t('directory.meta.tool_detail', {
      name: tool.value!.name,
      brand: t('directory.brand_name'),
    }),
  ),
  description: computed(() => tool.value!.short),
  type: 'article',
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: tool.value!.name,
          description: tool.value!.short,
          url: tool.value!.url,
          applicationCategory: category.value?.name,
          operatingSystem: 'Web',
          // No `aggregateRating`. The site collects upvotes, not star ratings, and
          // inventing a 4.6 would be fabricated review markup — Google treats that
          // as spam and it can earn a manual action.
        }),
      ),
    },
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: t('directory.tools'),
              item: `https://dirtool.com${isZh.value ? '/zh' : ''}/products`,
            },
            ...(category.value
              ? [
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: category.value.name,
                    item: `https://dirtool.com${isZh.value ? '/zh' : ''}/categories/${category.value.slug}`,
                  },
                ]
              : []),
            {
              '@type': 'ListItem',
              position: category.value ? 3 : 2,
              name: tool.value!.name,
              item: canonicalPath.value,
            },
          ],
        }),
      ),
    },
  ],
})
</script>

<template>
  <div v-if="tool" class="src-page mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <nav
      :aria-label="pick('面包屑', 'breadcrumb')"
      class="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      <NuxtLink :to="localePath('/')" class="shrink-0 transition-colors hover:text-foreground">
        {{ t('directory.discover') }}
      </NuxtLink>
      <Icon name="chevron-right" :size="14" class="shrink-0 opacity-50" />
      <NuxtLink :to="localePath('/products')" class="shrink-0 transition-colors hover:text-foreground">
        {{ t('directory.tools') }}
      </NuxtLink>
      <Icon name="chevron-right" :size="14" class="shrink-0 opacity-50" />
      <span class="min-w-0 truncate font-medium text-foreground">{{ tool.name }}</span>
    </nav>

    <div class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div class="min-w-0">
        <header class="mb-6 flex items-start gap-4">
          <div
            class="size-16 shrink-0 overflow-hidden rounded-md border border-border/60 bg-card"
          >
            <ToolLogo :logo="tool.logo" :name="tool.name" :size="64" />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="min-w-0 text-2xl font-bold tracking-tight sm:text-3xl">
                {{ tool.name }}
              </h1>
              <span
                v-if="tool.is_featured"
                class="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600"
              >
                <Icon name="sparkles" :size="14" />
                {{ t('directory.featured') }}
              </span>
            </div>
            <p v-if="tool.short" class="mt-1.5 text-base text-muted-foreground">
              {{ tool.short }}
            </p>
          </div>
        </header>

        <div v-if="tool.url" class="mb-6 flex flex-wrap items-center gap-2">
          <!-- The outbound rel has to match the invoice: a paid listing was sold a
               dofollow link, so shipping `nofollow` here would make the pricing
               page a lie in the one place a buyer would check. -->
          <a
            :href="withDirectoryUtm(tool.url)"
            target="_blank"
            :rel="tool.is_paid ? 'noopener noreferrer' : 'nofollow noopener noreferrer'"
            class="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/80"
          >
            {{ t('directory.visit_website') }}
            <Icon name="arrow-up-right" :size="14" />
          </a>
        </div>

        <div class="mb-8 space-y-4">
          <dl class="flex flex-wrap gap-x-6 gap-y-2">
            <div v-if="category" class="flex min-w-0 items-center gap-1.5" :title="t('directory.detail.category')">
              <dt class="shrink-0 text-muted-foreground">
                <Icon name="shapes" :size="16" />
                <span class="sr-only">{{ t('directory.detail.category') }}</span>
              </dt>
              <dd class="truncate text-sm font-medium">
                <NuxtLink
                  :to="localePath({ path: '/products', query: { category: category.slug } })"
                  class="transition-colors hover:text-primary"
                >
                  {{ category.name }}
                </NuxtLink>
              </dd>
            </div>

            <div v-if="tool.makerName" class="flex min-w-0 items-center gap-1.5" :title="t('directory.detail.maker')">
              <dt class="shrink-0 text-muted-foreground">
                <Icon name="user" :size="16" />
                <span class="sr-only">{{ t('directory.detail.maker') }}</span>
              </dt>
              <dd class="truncate text-sm font-medium">{{ tool.makerName }}</dd>
            </div>

            <div class="flex min-w-0 items-center gap-1.5" :title="t('directory.detail.listed_on')">
              <dt class="shrink-0 text-muted-foreground">
                <Icon name="calendar" :size="16" />
                <span class="sr-only">{{ t('directory.detail.listed_on') }}</span>
              </dt>
              <dd class="truncate text-sm font-medium">
                <time :datetime="listedOn">{{ listedOn }}</time>
              </dd>
            </div>
          </dl>

          <div v-if="tagLinks.length" class="flex flex-wrap gap-2">
            <NuxtLink
              v-for="tag in tagLinks"
              :key="tag.slug"
              :to="localePath({ path: '/products', query: { tag: tag.slug } })"
              class="inline-flex h-8 items-center rounded-full bg-secondary px-3.5 text-sm font-medium text-secondary-foreground transition hover:bg-primary/10 hover:text-primary"
            >
              #{{ tag.name }}
            </NuxtLink>
          </div>

          <div v-if="inCollections.length" class="space-y-2">
            <p class="text-xs font-medium tracking-wide uppercase text-muted-foreground">
              {{ t('directory.collections.in_collections') }}
            </p>
            <div class="flex flex-wrap gap-2">
              <NuxtLink
                v-for="collection in inCollections"
                :key="collection.slug"
                :to="localePath(`/collections/${collection.slug}`)"
                class="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm font-medium transition hover:border-primary/40 hover:text-primary"
              >
                {{ collection.name }}
              </NuxtLink>
            </div>
          </div>
        </div>

        <DirectoryScreenshotGallery :tool-name="tool.name" :screenshots="shots" />

        <DirectoryStickySectionNav :tabs="sectionTabs" />

        <DirectoryToolDetailSections
          v-model:open-faq="openFaq"
          :tool-name="tool.name"
          :overview="tool.long"
          :how-to-use="tool.detail.how_to_use"
          :features="tool.detail.features"
          :use-cases="tool.detail.use_cases"
          :pros="tool.detail.pros"
          :cons="tool.detail.cons"
          :faqs="tool.detail.faqs"
        />
      </div>

      <DirectoryToolDetailSidebar :top-picks="topPicks" />
    </div>

    <section v-if="related.length" class="mt-12">
      <div class="flex items-baseline justify-between gap-4 pb-3">
        <h2 class="text-lg font-semibold tracking-tight">
          {{ t('directory.detail.more_in', { category: category?.name || t('directory.tools') }) }}
        </h2>
        <NuxtLink
          v-if="category"
          :to="localePath({ path: '/products', query: { category: category.slug } })"
          class="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <span>{{ t('directory.view_all') }}</span>
          <Icon name="arrow-right" :size="14" />
        </NuxtLink>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DirectoryToolCard v-for="item in related" :key="item.slug" :tool="item" />
      </div>
    </section>
  </div>
</template>
