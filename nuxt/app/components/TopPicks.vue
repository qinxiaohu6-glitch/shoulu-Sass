<script setup lang="ts">
/**
 * "Top picks" rail block — ranked by votes this week, not by the directory's
 * paid/featured order, which is why it uses `boardRows` rather than
 * `orderedTools`.
 */
const props = withDefaults(
  defineProps<{ limit?: number; title?: string }>(),
  { limit: 5 },
)

const { lang, pick } = useLang()
const localePath = useLocalePath()

const latestWeek = computed(() =>
  [...weeks].sort((a, b) => (a.id < b.id ? 1 : -1))[0],
)
const rows = computed(() => boardRows(latestWeek.value, lang.value, props.limit))
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
        <NuxtLink v-if="row.tool" class="rail-item" :to="localePath(`/tools/${row.tool.slug}`)">
          <span class="rail-item__rank" :class="{ 'is-top': row.rank <= 3 }">{{ row.rank }}</span>
          <span class="tool-icon" style="width: 32px; height: 32px">
            <img :src="`/${row.tool.logo}`" alt="" width="32" height="32" loading="lazy" >
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
