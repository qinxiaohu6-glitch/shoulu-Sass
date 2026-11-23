<script setup lang="ts">
/**
 * /stats — the public number page. The figures are the /api/stats payload.
 * A failed read hides the grid instead of printing zeros.
 */
import { englishCount } from '~~/shared/utils/english-count'

const { pick, isZh } = useLang()
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
  const items: { label: string; value: string; note?: string }[] = [
    { label: isZh.value ? '个产品' : englishCount(row.products, 'product'), value: String(row.products) },
    {
      label: isZh.value ? '个分类' : englishCount(row.categories, 'category', 'categories'),
      value: String(row.categories),
    },
    {
      label: isZh.value ? '个免费提交在排队' : `${englishCount(row.free_pending, 'free submission')} in queue`,
      value: String(row.free_pending),
    },
    {
      label: isZh.value
        ? '个已确认 Billboard'
        : `confirmed Billboard ${englishCount(row.billboard_confirmed, 'spot')}`,
      value: String(row.billboard_confirmed),
    },
    {
      label: isZh.value ? '个右栏周次可订' : `sidebar ${englishCount(row.bookable_weeks, 'week')} open`,
      value: String(row.bookable_weeks),
    },
    {
      label: isZh.value ? '张本周票' : `${englishCount(row.week_votes, 'vote')} this week`,
      value: String(row.week_votes),
    },
  ]
  if (row.median_review_days != null) {
    items.push({
      label: pick('天，最近审核中位', 'median review days'),
      value: String(row.median_review_days),
      note: pick('仅针对已审完的免费收录。', 'For free listings that have already been reviewed.'),
    })
  }
  return items
})

useSeo({
  title: computed(() => pick('目录数字 · dirtool', 'Directory numbers · dirtool')),
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
          name: 'dirtool directory numbers',
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
        <small v-if="cell.note">{{ cell.note }}</small>
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
.stats-grid span,
.stats-grid small {
  color: var(--muted-foreground);
  font-size: 13px;
}
.stats-grid small {
  display: block;
  margin-top: 6px;
}
</style>
