<script setup lang="ts">
/**
 * "Top picks" rail block — the open UTC week's board, not the directory's
 * paid/featured order and not the build-time catalogue votes.
 */
const props = withDefaults(
  defineProps<{ limit?: number; title?: string }>(),
  { limit: 5 },
)

const { lang, pick } = useLang()
const localePath = useLocalePath()
const overrides = useOverrides()
const submitted = await useSubmittedTools()
const boardData = await useBoardData()

const directory = computed(() =>
  mergeDirectory(orderedTools(lang.value, overrides.value), submitted.value, overrides.value),
)

const rows = computed(() => {
  const bySlug = new Map(directory.value.map((tool) => [tool.slug, tool]))
  return (boardData.value.current?.ranking ?? [])
    .filter((row) => row.votes > 0)
    .slice(0, props.limit)
    .map((row, index) => ({
      rank: row.rank ?? index + 1,
      votes: row.votes,
      tool: bySlug.get(row.slug),
    }))
    .filter((row) => row.tool)
})
</script>

<template>
  <section>
    <div class="section-head section-head--stack">
      <div class="section-head__title">
        <h2>{{ title || pick('本周热门', 'Top picks') }}</h2>
      </div>
    </div>
    <p class="rail-sub">{{ pick('按本周票数排序', 'Ranked by votes this week') }}</p>

    <ol class="rail-list">
      <li v-for="row in rows" :key="row.tool?.slug || row.rank">
        <NuxtLink v-if="row.tool" class="rail-item" :to="localePath(`/products/${row.tool.slug}`)">
          <span class="rail-item__rank" :class="{ 'is-top': row.rank <= 3 }">{{ row.rank }}</span>
          <span class="tool-icon" style="width: 32px; height: 32px">
            <ToolLogo :logo="row.tool.logo" :name="row.tool.name" :size="32" decorative />
          </span>
          <span class="rail-item__body">
            <p>{{ row.tool.name }}</p>
            <p>{{ row.votes }} {{ pick('票', 'votes') }}</p>
          </span>
        </NuxtLink>
      </li>
    </ol>
  </section>
</template>
