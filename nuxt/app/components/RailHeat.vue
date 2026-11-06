<script setup lang="ts">
/**
 * "Last week" rail card: the archived total, the change against the week
 * before, and a sparkline over the last five archived weeks.
 *
 * The live SVG maps value → y with `y = 27 - ratio * 22` inside a 136×30 box.
 * Same maths here so the curve keeps the original geometry instead of being
 * re-scaled by a chart library.
 */
const { lang, pick } = useLang()

const stats = computed(() => {
  const sorted = [...weeks].sort((a, b) => (a.id < b.id ? 1 : -1))
  const total = (w?: (typeof sorted)[number]) =>
    w ? w.ranking.reduce((sum, row) => sum + row.votes, 0) : 0
  const current = total(sorted[0])
  const previous = total(sorted[1])
  return {
    current,
    previous,
    delta: previous ? Math.round(((current - previous) / previous) * 100) : 0,
    // The rail drops the year the archive label carries ("Oct 26 – Nov 1").
    label: (lang.value === 'zh' ? sorted[0]?.label_zh : sorted[0]?.label_en)?.replace(/,\s*\d{4}$/, '') ?? '',
  }
})

const spark = computed(() => {
  const series = [...weeks]
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .slice(0, 5)
    .reverse()
    .map((w) => w.ranking.reduce((sum, row) => sum + row.votes, 0))
  if (series.length < 2) return null
  const max = Math.max(...series)
  const min = Math.min(...series)
  const span = max - min || 1
  const pts = series.map((v, i) => {
    const x = 2 + (i * 132) / (series.length - 1)
    const y = 27 - ((v - min) / span) * 22
    return [Number(x.toFixed(1)), Number(y.toFixed(2))] as const
  })
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  return { line, area: `${line} L${last[0]},30 L${first[0]},30 Z`, dot: last }
})

const deltaClass = computed(() =>
  stats.value.delta > 0 ? 'is-up' : stats.value.delta < 0 ? 'is-down' : 'is-flat',
)
</script>

<template>
  <div v-if="spark" class="rail-heat">
    <div class="rail-heat__top">
      <span class="rail-heat__label">{{ pick('上周票数', 'Last week') }}</span>
      <span class="rail-heat__delta" :class="deltaClass">
        {{ stats.delta >= 0 ? '+' : '' }}{{ stats.delta }}%
        <em>{{ pick('较前一周', 'vs the week before') }}</em>
      </span>
    </div>
    <p class="rail-heat__num">
      {{ stats.current.toLocaleString() }}<span>{{ pick('票', 'votes') }}</span>
    </p>
    <svg
      class="rail-heat__spark"
      viewBox="0 0 136 30"
      width="136"
      height="30"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path class="rail-heat__area" :d="spark.area" />
      <path class="rail-heat__line" :d="spark.line" fill="none" />
      <circle class="rail-heat__dot" :cx="spark.dot[0]" :cy="spark.dot[1]" r="2.5" />
    </svg>
    <p class="rail-heat__foot">{{ stats.label }} · {{ pick('每周总票数', 'weekly totals') }}</p>
  </div>
</template>
