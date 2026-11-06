<script setup lang="ts">
/**
 * /tags — ported from `shipany-dir/src/routes/tags/index.tsx`.
 *
 * A cloud of pills: `#name` followed by the count.
 *
 * Counts come from the same merged list the tag page renders, so a pill and the
 * page behind it cannot disagree. The source's service does not order the rows at
 * all (no `ORDER BY`), so the pills would arrive in insertion order; this build
 * keeps its existing count-descending order, which is the only thing that makes a
 * cloud readable.
 */
const { lang, pick } = useLang()
const localePath = useLocalePath()
const t = useDirectoryCopy()

const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { tags: liveTags } = useDirectoryMeta()

const counts = computed(() => {
  const merged = mergeDirectory(
    orderedTools(lang.value, overrides.value),
    submitted.value,
    overrides.value,
  )
  const map = new Map<string, number>()
  for (const tool of merged) {
    for (const name of tool.tags) {
      const slug = slugify(name)
      map.set(slug, (map.get(slug) ?? 0) + 1)
    }
  }
  return map
})

const pills = computed(() =>
  liveTags.value
    .map((entry) => ({
      slug: entry.slug,
      name: localizeTag(entry, lang.value).name,
      count: counts.value.get(entry.slug) ?? 0,
    }))
    .sort((a, b) => b.count - a.count),
)

const title = computed(() => t('directory.tags.title'))
const lead = computed(() => t('directory.tags.subtitle'))

useSeo({
  title: computed(() =>
    t('directory.meta.tags', {
      count: pills.value.length,
      brand: t('directory.brand_name'),
    }),
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
        {{ t('directory.tags') }}
      </span>
    </nav>

    <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ title }}</h1>
    <p class="mt-1.5 mb-8 max-w-2xl text-sm text-muted-foreground">{{ lead }}</p>

    <div class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="pill in pills"
        :key="pill.slug"
        :to="localePath(`/tags/${pill.slug}`)"
        class="inline-flex h-8 items-center rounded-full bg-secondary px-3.5 text-sm font-medium text-secondary-foreground transition hover:bg-primary/10 hover:text-primary"
      >
        #{{ pill.name }}
        <span class="ml-1.5 tabular-nums text-muted-foreground">{{ pill.count }}</span>
      </NuxtLink>
    </div>
  </div>
</template>
