<script setup lang="ts">
/**
 * /categories/:slug — ported from `shipany-dir/src/routes/categories/$slug.tsx`.
 *
 * Same shell as `/tools` minus the pill strip: breadcrumb, the category's own
 * heading and description, a count + sort row, the sponsor slot, the grid and the
 * pager. `?page` and `?sort` are the only query keys, exactly as the source's
 * `validateSearch` declares.
 *
 * The source's head also emits `listingJsonLd(...)`; that is the `ItemList` below.
 * It is worth keeping rather than dropping as decoration — it is what tells Google
 * the page is a list of products rather than an article.
 */
const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const t = useDirectoryCopy()

const slug = computed(() => String(route.params.slug || ''))
/* A category the operator tombstoned is absent from the live list, so this 404s
   exactly like one that never existed — which is the point of a tombstone. */
const { categories: liveCategories } = useDirectoryMeta()
const raw = computed(() => categoryBySlug(slug.value, liveCategories.value))

if (!raw.value) {
  throw createError({
    statusCode: 404,
    statusMessage: isZh.value ? '没有这个分类' : 'No such category',
    fatal: true,
  })
}

const category = computed(() => localizeCategory(raw.value!, lang.value))

const submitted = await useSubmittedTools()
const overrides = useOverrides()

const list = computed(() =>
  mergeDirectory(
    toolsByCategory(slug.value, lang.value, overrides.value),
    submitted.value.filter((tool) => tool.category === slug.value),
    overrides.value,
  ),
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
  return { path: `/categories/${slug.value}`, query: next }
}

function chooseSort(next: string) {
  router.push(withQuery({ sort: next === 'recommended' ? undefined : next, page: undefined }))
}

function goPage(next: number) {
  router.push(withQuery({ page: next > 1 ? next : undefined }))
}

const heading = computed(() =>
  t('directory.heading.category_tools', { name: category.value.name }),
)
const countText = computed(() =>
  t('directory.category_named_count', { count: total.value, name: category.value.name }),
)

const metaTitle = computed(() =>
  t('directory.category.meta_title', {
    count: total.value,
    name: category.value.name,
    year: new Date().getFullYear(),
  }),
)
const metaDescription = computed(
  () =>
    category.value.desc ||
    t('directory.category.meta_desc', { count: total.value, name: category.value.name }),
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
      <NuxtLink :to="localePath('/categories')" class="shrink-0 hover:text-foreground">
        {{ t('directory.categories') }}
      </NuxtLink>
      <Icon name="chevron-right" :size="14" class="shrink-0" />
      <span aria-current="page" class="min-w-0 truncate text-foreground">
        {{ category.name }}
      </span>
    </nav>

    <header class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ heading }}</h1>
      <p v-if="category.desc" class="mt-1.5 max-w-2xl text-sm text-muted-foreground">
        {{ category.desc }}
      </p>
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
