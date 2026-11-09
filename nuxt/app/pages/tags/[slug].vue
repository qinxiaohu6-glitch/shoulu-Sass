<script setup lang="ts">
/**
 * /tags/:slug — ported from `shipany-dir/src/routes/tags/$slug.tsx`.
 *
 * The category page's twin: breadcrumb, `{name} AI tools` heading, count + sort,
 * sponsor slot, grid, pager. No description — a tag has no blurb in either build.
 *
 * Note the default order: the source's `recommended` for a tag is still whatever
 * the service returns, but the live `/tags/api.html` ranks by votes, which is why
 * `toolsByTag()` sorts by `votes_week` before `sortTools()` sees the list.
 */
const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const t = useDirectoryCopy()

const slug = computed(() => String(route.params.slug || ''))
const { tags: liveTags } = useDirectoryMeta()
const raw = computed(() => tagBySlug(slug.value, liveTags.value))

if (!raw.value) {
  throw createError({
    statusCode: 404,
    statusMessage: isZh.value ? '没有这个标签' : 'No such tag',
    fatal: true,
  })
}

const tag = computed(() => localizeTag(raw.value!, lang.value))

const submitted = await useSubmittedTools()
const overrides = useOverrides()

// Tag pages rank by this week's votes, so submissions sort into the same list
// rather than being appended as a separate block.
const list = computed(() =>
  [
    ...toolsByTag(slug.value, lang.value, overrides.value),
    ...submitted.value
      .filter((tool) => !isHiddenTool(tool, overrides.value))
      .filter((tool) => tool.tags.some((name) => slugify(name) === slug.value)),
  ].sort((a, b) => b.votes_week - a.votes_week),
)

const sort = computed(() => parseSort(route.query.sort))
const page = computed(() => parsePage(route.query.page))
const sorted = computed(() => sortTools(list.value, sort.value, lang.value))
const total = computed(() => sorted.value.length)
const totalPages = computed(() => Math.ceil(total.value / DIRECTORY_PAGE_SIZE))
const items = computed(() => pageSlice(sorted.value, page.value))

function withQuery(patch: Record<string, string | number | undefined>) {
  const next: Record<string, string> = { ...(route.query as Record<string, string>) }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') delete next[key]
    else next[key] = String(value)
  }
  if (next.page === '1') delete next.page
  return { path: `/tags/${slug.value}`, query: next }
}

function chooseSort(next: string) {
  router.push(withQuery({ sort: next === 'recommended' ? undefined : next, page: undefined }))
}

function goPage(next: number) {
  router.push(withQuery({ page: next > 1 ? next : undefined }))
}

const heading = computed(() => t('directory.heading.tag_tools', { name: tag.value.name }))
const countText = computed(() =>
  t('directory.tag_named_count', { count: total.value, name: tag.value.name }),
)

const metaTitle = computed(() =>
  t('directory.tag.meta_title', {
    count: total.value,
    name: tag.value.name,
    year: new Date().getFullYear(),
  }),
)
const metaDescription = computed(() =>
  t('directory.tag.meta_desc', { count: total.value, name: tag.value.name }),
)

useSeo({
  title: computed(() =>
    t('directory.meta.with_brand', { title: metaTitle.value, brand: t('directory.brand_name') }),
  ),
  description: metaDescription,
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: metaTitle.value,
          description: metaDescription.value,
          numberOfItems: total.value,
          itemListElement: items.value.map((tool, index) => ({
            '@type': 'ListItem',
            position: (page.value - 1) * DIRECTORY_PAGE_SIZE + index + 1,
            name: tool.name,
            url: `https://dirtool.com${isZh.value ? '/zh' : ''}/products/${tool.slug}`,
          })),
        }),
      ),
    },
  ],
})
</script>

<template>
  <div class="src-page mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <nav
      :aria-label="pick('面包屑', 'breadcrumb')"
      class="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      <NuxtLink :to="localePath('/')" class="shrink-0 hover:text-foreground">
        {{ t('directory.discover') }}
      </NuxtLink>
      <Icon name="chevron-right" :size="14" class="shrink-0" />
      <NuxtLink :to="localePath('/tags')" class="shrink-0 hover:text-foreground">
        {{ t('directory.tags') }}
      </NuxtLink>
      <Icon name="chevron-right" :size="14" class="shrink-0" />
      <span aria-current="page" class="min-w-0 truncate text-foreground">
        {{ heading }}
      </span>
    </nav>

    <header class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ heading }}</h1>
    </header>

    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-sm font-normal text-muted-foreground">{{ countText }}</h2>
      <DirectorySortSelect :value="sort" @change="chooseSort" />
    </div>

    <div class="mb-6 max-w-md">
      <SponsorAdsSlot placement="listing" :limit="4" />
    </div>

    <div
      v-if="!items.length"
      class="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground"
    >
      {{ t('directory.no_tools') }}
    </div>
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <DirectoryToolCard v-for="tool in items" :key="tool.slug" :tool="tool" />
    </div>

    <div v-if="totalPages > 1" class="mt-8 flex justify-center">
      <DirectoryPagination :current-page="page" :total-pages="totalPages" @change="goPage" />
    </div>
  </div>
</template>
