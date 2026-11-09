<script setup lang="ts">
/**
 * /products — the directory list, moved off /tools so that path can be the utility hub.
 *
 * The page is a filter over one list: breadcrumb, header, an optional tag chip,
 * the category pill strip, a count + sort row, the sponsor slot, the card grid and
 * the pager. State lives in the query string exactly as the source's
 * `validateSearch` puts it there — `?category`, `?tag`, `?sort`, `?page` — so a
 * filtered view is linkable.
 *
 * Data: the source asks `getDirectoryToolsFn({ locale, category, tag, sort, page,
 * pageSize: 24 })`. This build has no such endpoint — the catalogue is an import
 * and community listings come from the database — so the same list is assembled
 * here and the four sorts are applied in `sortTools()`.
 *
 * Deliberate omissions, all of them the source's own:
 *  - no search box (the source searches from the header modal, not this page);
 *  - `sort=recommended` and `page=1` never appear in the URL.
 */
import type { DirectorySortValue } from '~/utils/directory-ui'

const { lang, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const t = useDirectoryCopy()

const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { categories: liveCategories } = useDirectoryMeta()

const all = computed(() =>
  mergeDirectory(orderedTools(lang.value, overrides.value), submitted.value, overrides.value),
)

/* --- query state (the source's `validateSearch`) -------------------------- */

const category = computed(() => String(route.query.category ?? ''))
const tag = computed(() => String(route.query.tag ?? ''))
const sort = computed(() => parseSort(route.query.sort))
const page = computed(() => parsePage(route.query.page))

const filtered = computed(() => {
  let list = all.value
  if (category.value) list = list.filter((tool) => tool.category === category.value)
  if (tag.value) {
    const slug = slugify(tag.value)
    list = list.filter((tool) => tool.tags.some((name) => slugify(name) === slug))
  }
  return list
})

const sorted = computed(() => sortTools(filtered.value, sort.value, lang.value))
const total = computed(() => sorted.value.length)
const totalPages = computed(() => Math.ceil(total.value / DIRECTORY_PAGE_SIZE))
const items = computed(() => pageSlice(sorted.value, page.value))

/** The category strip, in catalogue order — the source's `data.categories`. */
const pills = computed(() =>
  liveCategories.value
    .filter((entry) => entry.status !== 'deleted')
    .map((entry) => ({ slug: entry.slug, name: localizeCategory(entry, lang.value).name })),
)

function withQuery(patch: Record<string, string | number | undefined>) {
  const next: Record<string, string> = { ...(route.query as Record<string, string>) }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') delete next[key]
    else next[key] = String(value)
  }
  // Page 1 is the default, so it never appears in the URL — the source's
  // `page > 1 ? page : undefined`.
  if (next.page === '1') delete next.page
  return { path: '/products', query: next }
}

function chooseCategory(slug: string) {
  // Picking a category clears the tag and returns to page 1, as the source's
  // `search` updater does.
  router.push(withQuery({ category: slug || undefined, tag: undefined, page: undefined }))
}

function chooseSort(next: DirectorySortValue) {
  router.push(withQuery({ sort: next === 'recommended' ? undefined : next, page: undefined }))
}

function goPage(next: number) {
  router.push(withQuery({ page: next > 1 ? next : undefined }))
}

/* --- head ---------------------------------------------------------------- */

const title = computed(() => t('directory.tools.title'))
const lead = computed(() => t('directory.tools.subtitle'))

useSeo({
  title: computed(() =>
    t('directory.meta.tools', { count: total.value, brand: t('directory.brand_name') }),
  ),
  description: lead,
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
      <span aria-current="page" class="min-w-0 truncate text-foreground">
        {{ t('directory.tools') }}
      </span>
    </nav>

    <header class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ title }}</h1>
      <p class="mt-1.5 max-w-2xl text-sm text-muted-foreground">{{ lead }}</p>
    </header>

    <div v-if="tag" class="mb-4">
      <span
        class="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
      >
        #{{ tag }}
      </span>
    </div>

    <div class="mb-6">
      <nav
        class="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <button
          type="button"
          :aria-current="!category ? 'page' : undefined"
          class="inline-flex h-8 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition"
          :class="
            !category
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
          "
          @click="chooseCategory('')"
        >
          {{ t('directory.all') }}
        </button>
        <button
          v-for="pill in pills"
          :key="pill.slug"
          type="button"
          :aria-current="category === pill.slug ? 'page' : undefined"
          class="inline-flex h-8 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition"
          :class="
            category === pill.slug
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
          "
          @click="chooseCategory(pill.slug)"
        >
          {{ pill.name }}
        </button>
      </nav>
    </div>

    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-sm font-normal text-muted-foreground">
        {{
          category
            ? t('directory.tools.filtered_count', { count: total })
            : t('directory.tools.all_count', { count: total })
        }}
      </h2>

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
      <DirectoryPagination
        :current-page="page"
        :total-pages="totalPages"
        @change="goPage"
      />
    </div>
  </div>
</template>
