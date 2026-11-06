<script setup lang="ts">
/**
 * /feed — ported from `shipany-dir/src/routes/feed/index.tsx`.
 *
 * A day-by-day timeline of what was listed, with a "Community submissions"
 * filter. Structure, grouping and copy follow the source.
 *
 * Data mapping — the source asks its service layer for
 * `{ sort: 'latest', pageSize: 500, source }`; this build has the catalogue in
 * a JSON file plus community listings from the database, so the same list is
 * assembled here:
 *
 *  - `?type=community` → community listings only, exactly the source's
 *    `source: 'community'`.
 *  - no filter → curated catalogue merged with community listings, then sorted
 *    by listing date, which is what `sort: 'latest'` does.
 *
 * One deliberate deviation: the source builds each row's icon as
 * `https://www.google.com/s2/favicons?domain=<host>` whenever the tool has a
 * website URL, and only falls back to the stored icon. That would fire a
 * request to Google for every row on every view. The rows here render the
 * site's own `ToolLogo`, which draws the stored logo and a monogram when there
 * is none — same 40×40 box, no third-party call, and no empty square for the
 * community listings that carry no logo at all.
 */
const { lang, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()

const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { categories: liveCategories } = useDirectoryMeta()

/** `?type=community` — the source's `validateSearch`. Anything else means all. */
const activeType = computed<'all' | 'community'>(() =>
  route.query.type === 'community' ? 'community' : 'all',
)

const items = computed(() => {
  const list =
    activeType.value === 'community'
      ? submitted.value
      : mergeDirectory(
          orderedTools(lang.value, overrides.value),
          submitted.value,
          overrides.value,
        )
  return [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 500)
})

/* --- date grouping (UTC, newest first) ------------------------------------ */

function toUtcDateKey(dateInput: string): string {
  return new Date(dateInput).toISOString().slice(0, 10)
}

function formatDateLabel(dateStr: string): string {
  const todayKey = new Date().toISOString().slice(0, 10)
  const diffDays = Math.round((Date.parse(todayKey) - Date.parse(dateStr)) / 86_400_000)

  if (diffDays === 0) return pick('今天', 'today')
  if (diffDays === 1) return pick('昨天', 'yesterday')

  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))

  return new Intl.DateTimeFormat(lang.value || 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

const groupedItems = computed(() => {
  const dateMap = new Map<string, typeof items.value>()

  for (const item of items.value) {
    const dateKey = toUtcDateKey(item.created_at)
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
    dateMap.get(dateKey)!.push(item)
  }

  return [...dateMap.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((dateKey) => ({
      dateKey,
      dateLabel: formatDateLabel(dateKey),
      tools: dateMap.get(dateKey)!,
    }))
})

/** Category label for a row, or nothing when the slug no longer resolves. */
function categoryName(slug: string): string | null {
  const hit = categoryBySlug(slug, liveCategories.value)
  return hit ? localizeCategory(hit, lang.value).name : null
}

useSeo({
  // `directory.meta.feed`: "New AI tools — latest additions | {brand}".
  title: computed(() =>
    pick('最新 AI 工具 — 每日新收录 | Product Atlas', 'New AI tools — latest additions | Product Atlas'),
  ),
  description: computed(() =>
    pick(
      '按天展示新收录的 AI 工具，包括社区用户提交的工具。',
      'Newly listed AI tools, day by day — including tools submitted by the community.',
    ),
  ),
})
</script>

<template>
  <div class="src-page mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <!-- Breadcrumb -->
    <nav
      :aria-label="pick('面包屑', 'breadcrumb')"
      class="mb-5 flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      <NuxtLink :to="localePath('/')" class="shrink-0 hover:text-foreground">
        {{ pick('发现', 'Discover') }}
      </NuxtLink>
      <Icon name="chevron-right" :size="14" class="shrink-0" />
      <span aria-current="page" class="min-w-0 truncate text-foreground">
        {{ pick('动态', 'Feed') }}
      </span>
    </nav>

    <!-- Header -->
    <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
      {{ pick('最新 AI 工具', 'Latest AI tools') }}
    </h1>
    <p class="mb-6 mt-1.5 max-w-2xl text-sm text-muted-foreground">
      {{ pick(
        '按天展示新收录的 AI 工具，包括社区用户提交的工具。',
        'Newly listed AI tools, day by day — including tools submitted by the community.',
      ) }}
    </p>

    <!-- Filter tabs -->
    <nav class="mb-8 flex gap-2">
      <NuxtLink
        :to="localePath('/feed')"
        :aria-current="activeType === 'all' ? 'page' : undefined"
        class="inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition"
        :class="
          activeType === 'all'
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
        "
      >
        {{ pick('全部', 'All') }}
      </NuxtLink>
      <NuxtLink
        :to="localePath({ path: '/feed', query: { type: 'community' } })"
        :aria-current="activeType === 'community' ? 'page' : undefined"
        class="inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition"
        :class="
          activeType === 'community'
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
        "
      >
        {{ pick('社区提交', 'Community submissions') }}
      </NuxtLink>
    </nav>

    <!-- Timeline + sponsors -->
    <div class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div class="min-w-0">
        <div
          v-if="groupedItems.length === 0"
          class="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground"
        >
          {{ activeType === 'community'
            ? pick('还没有社区提交的工具，来提交第一个吧。', 'No community submissions yet. Be the first to submit a tool.')
            : pick('暂无工具', 'No tools found') }}
          <NuxtLink
            v-if="activeType === 'community'"
            :to="localePath('/submit')"
            class="inline-flex h-7 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-transparent bg-primary bg-clip-padding px-2.5 text-[0.8rem] font-medium text-primary-foreground outline-none transition-all select-none hover:bg-primary/80"
          >
            {{ pick('提交工具', 'Submit a tool') }}
          </NuxtLink>
        </div>

        <ol v-else class="relative space-y-8 border-l border-border pl-6">
          <li v-for="group in groupedItems" :key="group.dateKey">
            <span
              class="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-primary ring-4 ring-background"
            />
            <h2 class="mb-3 flex items-baseline gap-2">
              <span class="text-base font-semibold">{{ group.dateLabel }}</span>
              <span class="text-xs tabular-nums text-muted-foreground">
                {{ pick(`新增 ${group.tools.length} 款`, `${group.tools.length} new`) }}
              </span>
            </h2>
            <ul
              class="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
            >
              <li v-for="tool in group.tools" :key="tool.slug">
                <NuxtLink
                  :to="localePath(`/tools/${tool.slug}`)"
                  class="flex items-center gap-3 px-4 py-3 transition hover:bg-secondary/50"
                >
                  <span
                    class="shrink-0 overflow-hidden rounded-lg border border-border/60 bg-secondary/50"
                    style="width: 40px; height: 40px"
                  >
                    <ToolLogo :logo="tool.logo" :name="tool.name" :size="40" lazy decorative />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-1.5">
                      <span class="truncate font-semibold">{{ tool.name }}</span>
                      <span
                        v-if="isPinned(tool, undefined, overrides) || tool.is_featured"
                        :title="pick('精选', 'Featured')"
                        class="shrink-0"
                      >
                        <Icon name="sparkles" :size="14" class="text-amber-500" />
                        <span class="sr-only">{{ pick('精选', 'Featured') }}</span>
                      </span>
                    </span>
                    <p v-if="tool.short" class="truncate text-[13px] text-muted-foreground">
                      {{ tool.short }}
                    </p>
                  </span>
                  <span v-if="categoryName(tool.category)" class="hidden shrink-0 items-center gap-2 sm:flex">
                    <span
                      class="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                    >
                      {{ categoryName(tool.category) }}
                    </span>
                  </span>
                </NuxtLink>
              </li>
            </ul>
          </li>
        </ol>
      </div>

      <aside
        class="self-start lg:sticky lg:top-[calc(var(--header-h,3.5rem)+1.5rem+var(--banner-h))]"
      >
        <SponsorAdsSlot placement="listing" :limit="4" />
      </aside>
    </div>
  </div>
</template>
