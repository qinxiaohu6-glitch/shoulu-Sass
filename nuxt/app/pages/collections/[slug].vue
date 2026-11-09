<script setup lang="ts">
/**
 * /collections/:slug — one curated shortlist.
 *
 * The order is the feature. A collection is "the five you should try first",
 * so the default view keeps the operator's sequence and the sort control is a
 * deliberate way to leave it — not the default.
 *
 * Members resolve against the live tool list rather than against a copy of the
 * rows, so a pulled listing disappears here at the same moment it disappears
 * from `/tools`, and the count matches what is on screen.
 */
import type { LocalizedTool } from '~~/shared/types/catalog'

const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const overrides = useOverrides()

const slug = computed(() => String(route.params.slug || ''))

/* Drafts never reach this page: `directoryMeta` filters them out server-side,
   so a collection that is not published 404s exactly like one that does not
   exist. That is the intended behaviour — a draft is not a teaser. */
const { collections } = useDirectoryMeta()
const raw = computed(() => collections.value.find((c) => c.slug === slug.value))

if (!raw.value) {
  throw createError({
    statusCode: 404,
    statusMessage: isZh.value ? '没有这个合集' : 'No such collection',
    fatal: true,
  })
}

const collection = computed(() => localizeCollection(raw.value!, lang.value))

const submitted = await useSubmittedTools()

const toolIndex = computed(() => {
  const merged = mergeDirectory(
    orderedTools(lang.value, overrides.value),
    submitted.value,
    overrides.value,
  )
  return new Map(merged.map((tool) => [tool.slug, tool]))
})

/**
 * The curated sequence, with anything unrenderable dropped.
 *
 * A member can vanish three ways — the slug never existed, the listing was
 * hidden by the operator, or it is a submission that has not been published
 * yet. All three resolve to `undefined` here and are filtered out, so the
 * heading's count is the number of cards below it.
 */
const members = computed<LocalizedTool[]>(() =>
  raw.value!.tools
    .map((memberSlug) => toolIndex.value.get(memberSlug))
    .filter((tool): tool is LocalizedTool => Boolean(tool)),
)

/* --- sort ---------------------------------------------------------------- */

const PER = 24

const SORTS = ['recommended', 'newest', 'votes'] as const
type Sort = (typeof SORTS)[number]

const sort = computed<Sort>(() => {
  const value = String(route.query.sort ?? '')
  return (SORTS as readonly string[]).includes(value) ? (value as Sort) : 'recommended'
})

const sorted = computed(() => {
  const list = [...members.value]
  if (sort.value === 'newest') return list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  if (sort.value === 'votes') return list.sort((a, b) => b.votes_week - a.votes_week)
  // `recommended` is the stored order — already what `members` returns.
  return list
})

const page = computed(() => Math.max(1, Number.parseInt(String(route.query.page ?? '1'), 10) || 1))
const pageCount = computed(() => Math.max(1, Math.ceil(sorted.value.length / PER)))
const paged = computed(() => sorted.value.slice((page.value - 1) * PER, page.value * PER))

function withQuery(patch: Record<string, string | undefined>) {
  const next = { ...route.query, ...patch }
  for (const key of Object.keys(next)) if (!next[key]) delete next[key]
  return { path: route.path, query: next }
}

function onSort(value: string) {
  router.push(withQuery({ sort: value === 'recommended' ? undefined : value, page: undefined }))
}

/* --- copy ---------------------------------------------------------------- */

const countLabel = computed(() =>
  isZh.value
    ? `${sorted.value.length} 款精选工具`
    : `${sorted.value.length} curated tool${sorted.value.length === 1 ? '' : 's'}`,
)

useSeo({
  title: computed(() =>
    isZh.value
      ? `${collection.value.name} · ${sorted.value.length} 款精选 AI 工具 · Product Atlas`
      : `${collection.value.name} · ${sorted.value.length} curated AI tools · Product Atlas`,
  ),
  description: computed(() =>
    collection.value.desc ||
    (isZh.value
      ? `${collection.value.name}：精选 ${sorted.value.length} 款值得一试的 AI 工具合集。`
      : `${collection.value.name}: a curated list of ${sorted.value.length} AI tools worth trying.`),
  ),
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: collection.value.name,
          description: collection.value.desc,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: sorted.value.length,
            itemListElement: sorted.value.map((tool, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              url: `https://dirtool.com/products/${tool.slug}`,
              name: tool.name,
            })),
          },
        }),
      ),
    },
  ],
})
</script>

<template>
  <div class="container">
    <nav class="breadcrumb" :aria-label="pick('面包屑', 'breadcrumb')">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" />
      <NuxtLink :to="localePath('/collections')">{{ pick('合集', 'Collections') }}</NuxtLink>
      <Icon name="chevron-right" />
      <span>{{ collection.name }}</span>
    </nav>

    <header class="page-head">
      <h1 class="page-title">{{ collection.name }}</h1>
      <p v-if="collection.desc" class="page-sub">{{ collection.desc }}</p>
    </header>

    <div class="tools-toolbar">
      <h2 class="tools-count">{{ countLabel }}</h2>
      <label class="sort-select">
        <span class="sr-only">{{ pick('排序', 'Sort by') }}</span>
        <select :value="sort" @change="onSort(($event.target as HTMLSelectElement).value)">
          <option value="recommended">{{ pick('精选顺序', 'Curated order') }}</option>
          <option value="newest">{{ pick('最新', 'Newest') }}</option>
          <option value="votes">{{ pick('最热', 'Top voted') }}</option>
        </select>
        <Icon name="chevron-down" />
      </label>
    </div>

    <div v-if="paged.length" class="tool-grid">
      <ToolCard v-for="tool in paged" :key="tool.slug" :tool="tool" />
    </div>

    <p v-else class="coll-empty">
      {{ pick('这里还没有工具。', 'No tools here yet.') }}
    </p>

    <nav v-if="pageCount > 1" class="pagination" :aria-label="pick('分页', 'Pagination')">
      <NuxtLink
        class="page-btn"
        :class="{ 'is-disabled': page === 1 }"
        :to="withQuery({ page: String(Math.max(1, page - 1)) })"
      >
        <Icon name="chevron-left" :stroke-width="2" />
        <span>{{ pick('上一页', 'Previous') }}</span>
      </NuxtLink>
      <NuxtLink
        v-for="p in pageCount"
        :key="p"
        class="page-num"
        :class="{ 'is-active': p === page }"
        :to="withQuery({ page: String(p) })"
        :aria-current="p === page ? 'page' : undefined"
      >
        {{ p }}
      </NuxtLink>
      <NuxtLink
        class="page-btn"
        :class="{ 'is-disabled': page === pageCount }"
        :to="withQuery({ page: String(Math.min(pageCount, page + 1)) })"
      >
        <span>{{ pick('下一页', 'Next') }}</span>
        <Icon name="chevron-right" :stroke-width="2" />
      </NuxtLink>
    </nav>
  </div>
</template>
