<script setup lang="ts">
/**
 * /categories — ported from `shipany-dir/src/routes/categories/index.tsx`.
 *
 * A grid of cards, one per category: glyph, name, live tool count, description and
 * a trailing arrow that colours on hover.
 *
 * Two mappings:
 *
 *  - **The glyph.** The source's `getCategoryIcon()` keyword-matches the category's
 *    stored icon name against a lucide icon set. This build draws from a fixed
 *    sprite, so the same idea is already implemented in `collectionIcon()` — same
 *    keyword rules, only the glyphs that exist. Reusing it keeps one mapping
 *    rather than two that drift.
 *  - **The count.** `category.projectCount` on the server is a live count. Here it
 *    is counted off the same merged list `/tools` renders, so a category can never
 *    advertise a number its own page would not show.
 */
const { lang, pick } = useLang()
const localePath = useLocalePath()
const t = useDirectoryCopy()

const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { categories: liveCategories } = useDirectoryMeta()

const counts = computed(() => {
  const merged = mergeDirectory(
    orderedTools(lang.value, overrides.value),
    submitted.value,
    overrides.value,
  )
  const map = new Map<string, number>()
  for (const tool of merged) map.set(tool.category, (map.get(tool.category) ?? 0) + 1)
  return map
})

const cards = computed(() =>
  liveCategories.value
    .filter((entry) => entry.status !== 'deleted')
    .map((entry) => {
      const localized = localizeCategory(entry, lang.value)
      return {
        slug: entry.slug,
        icon: collectionIcon(entry.icon, entry.slug),
        name: localized.name,
        description: localized.desc,
        count: counts.value.get(entry.slug) ?? 0,
      }
    }),
)

const title = computed(() => t('directory.categories.title'))
const lead = computed(() => t('directory.categories.subtitle'))

useSeo({
  title: computed(() =>
    t('directory.meta.categories', {
      count: cards.value.length,
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
        {{ t('directory.categories') }}
      </span>
    </nav>

    <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ title }}</h1>
    <p class="mt-1.5 mb-8 max-w-2xl text-sm text-muted-foreground">{{ lead }}</p>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="card in cards"
        :key="card.slug"
        :to="localePath(`/categories/${card.slug}`)"
        class="group flex items-start gap-4 rounded-md border border-border bg-card p-4 transition hover:border-primary/30 hover:shadow-md"
      >
        <span class="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon :name="card.icon" :size="20" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <h2 class="truncate font-semibold">{{ card.name }}</h2>
            <span class="shrink-0 text-xs tabular-nums text-muted-foreground">
              {{ t('directory.categories.tools_count', { count: card.count }) }}
            </span>
          </div>
          <p v-if="card.description" class="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {{ card.description }}
          </p>
        </div>
        <Icon
          name="arrow-right"
          :size="16"
          class="mt-0.5 shrink-0 text-muted-foreground transition group-hover:text-primary"
        />
      </NuxtLink>
    </div>
  </div>
</template>
