<script setup lang="ts">
/**
 * /stats — the public number page. The figures are the /api/stats payload.
 * A failed read hides the grid instead of printing zeros.
 */
const { pick } = useLang()
const requestFetch = useRequestFetch()

type Stats = {
  ok: boolean
  products: number
  categories: number
  free_pending: number
  billboard_confirmed: number
  bookable_weeks: number
  week_votes: number
  median_review_days: number | null
  reviewed_last_30d: number
}

const { data } = await useAsyncData('public-stats', async () => {
  try {
    return await requestFetch<Stats>('/api/stats')
  } catch {
    return null
  }
})

const stats = computed(() => (data.value?.ok ? data.value : null))

const cells = computed(() => {
  const row = stats.value
  if (!row) return []
  const items: { label: string; value: string }[] = [
    { label: pick('个产品', 'products'), value: String(row.products) },
    { label: pick('个分类', 'categories'), value: String(row.categories) },
    { label: pick('个免费提交在排队', 'free submissions in queue'), value: String(row.free_pending) },
    { label: pick('个已确认 Billboard', 'confirmed Billboard spots'), value: String(row.billboard_confirmed) },
    { label: pick('个右栏周次可订', 'sidebar weeks open'), value: String(row.bookable_weeks) },
    { label: pick('张本周票', 'votes this week'), value: String(row.week_votes) },
  ]
  if (row.median_review_days != null) {
    items.push({
      label: pick('天，最近审核中位', 'median review days'),
      value: String(row.median_review_days),
    })
  }
  return items
})

useSeo({
  title: computed(() => pick('目录数字 · Product Atlas', 'Directory numbers · Product Atlas')),
  description: computed(() =>
    pick(
      '这一页的每个数字都来自当前目录。',
      'Every number on this page comes from the live directory.',
    ),
  ),
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: 'Product Atlas directory numbers',
          description: 'Counts read from the live directory: products, categories, queue, billboard, votes.',
          url: 'https://dirtool.com/stats',
        }),
      ),
    },
  ],
})
</script>

<template>
  <div class="container">
    <section class="mk-hero mk-hero--compact">
      <p class="mk-eyebrow">{{ pick('实时数字', 'Live numbers') }}</p>
      <h1 class="mk-h1">{{ pick('目录里现在有多少。', 'What the directory holds right now.') }}</h1>
      <p class="mk-sub">
        {{ pick('这一页的每个数字都来自当前目录。没有估出来的访问量或权重。', 'Every number on this page comes from the live directory. No estimated visits or authority.') }}
      </p>
    </section>
    <ul v-if="cells.length" class="stats-grid">
      <li v-for="cell in cells" :key="cell.label">
        <strong>{{ cell.value }}</strong>
        <span>{{ cell.label }}</span>
      </li>
    </ul>
    <p v-else class="mk-sub">{{ pick('数字暂时读不到。', 'The numbers are not available right now.') }}</p>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 0 0 32px;
  padding: 0;
  list-style: none;
}
.stats-grid li {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--card);
}
.stats-grid strong {
  display: block;
  font-size: 28px;
  letter-spacing: -0.03em;
}
.stats-grid span {
  color: var(--muted-foreground);
  font-size: 13px;
}
</style>
