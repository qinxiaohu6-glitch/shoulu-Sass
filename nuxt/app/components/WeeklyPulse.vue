<script setup lang="ts">
/**
 * The top data strip of the launch board — laid out like the leaderboard's
 * traffic header: a big number with a trend line on the left, three tallies
 * on the right.
 *
 * We do NOT run visitor analytics, so there is no "page views / 24h" here.
 * The left figure is this week's VOTES (from /api/board) and the line is the
 * last five weeks' vote totals (from the same archive). Every number has a
 * real source; an empty week draws no line and claims no traffic.
 */
const { isZh, pick } = useLang()
const boardData = await useBoardData()

const weekVotes = computed(() =>
  (boardData.value.current?.ranking ?? []).reduce((sum, row) => sum + row.votes, 0),
)
const weekProducts = computed(() => (boardData.value.current?.ranking ?? []).length)
const productCount = ref<number | null>(null)
const categoryCount = ref<number | null>(null)

// Live directory totals, fetched once; hidden entirely if the read fails.
const requestFetch = useRequestFetch()
try {
  const stats = await requestFetch<{ ok: boolean; products: number; categories: number }>('/api/stats')
  if (stats?.ok) {
    productCount.value = stats.products
    categoryCount.value = stats.categories
  }
} catch {
  // leave null → the template hides the number instead of printing 0
}

/** Last five closed weeks' total votes, oldest → newest. */
const series = computed(() =>
  [...(boardData.value.history ?? [])]
    .slice(0, 5)
    .reverse()
    .map((w) => w.ranking.reduce((sum, row) => sum + row.votes, 0)),
)

/** SVG polyline in a 300×70 box; null when there is no meaningful trend. */
const spark = computed(() => {
  const s = series.value
  if (s.length < 2) return null
  const max = Math.max(...s)
  const min = Math.min(...s)
  const span = max - min || 1
  const pts = s.map((v, i) => {
    const x = 2 + (i * 296) / (s.length - 1)
    const y = 62 - ((v - min) / span) * 52
    return [Number(x.toFixed(1)), Number(y.toFixed(2))] as const
  })
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
  const last = pts[pts.length - 1]!
  return { line, area: `${line} L${last[0]},70 L2,70 Z`, dot: last }
})
</script>

<template>
  <section class="pb-strip" aria-label="Board numbers">
    <div class="pb-strip__main">
      <div class="pb-strip__main-top">
        <span class="pb-strip__label"><i />{{ pick('本周票数', 'THIS WEEK’S VOTES') }}</span>
      </div>
      <p class="pb-strip__big">{{ weekVotes.toLocaleString() }}</p>
      <p class="pb-strip__hint">
        {{ isZh ? '本周累计获得的票数' : 'votes cast this week' }}
      </p>
      <svg
        v-if="spark"
        class="pb-strip__spark"
        viewBox="0 0 300 70"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path class="pb-strip__area" :d="spark.area" />
        <path class="pb-strip__line" :d="spark.line" fill="none" />
        <circle class="pb-strip__dot" :cx="spark.dot[0]" :cy="spark.dot[1]" r="3.5" />
      </svg>
      <p v-else class="pb-strip__spark-empty">
        {{ pick('往期归档后出现趋势', 'Trend appears once weeks are archived') }}
      </p>
      <p class="pb-strip__axis">
        <span>{{ pick('近 5 周', 'Last 5 weeks') }}</span>
        <span>{{ pick('当前', 'Now') }}</span>
      </p>
    </div>
    <div class="pb-strip__cols">
      <div class="pb-strip__col">
        <b>{{ productCount !== null ? productCount.toLocaleString() : '—' }}</b>
        <span>{{ pick('在架产品', 'Products listed') }}</span>
        <small>{{ pick('全站目录', 'in the directory') }}</small>
      </div>
      <div class="pb-strip__col">
        <b>{{ categoryCount !== null ? categoryCount.toLocaleString() : '—' }}</b>
        <span>{{ pick('分类', 'Categories') }}</span>
        <small>{{ pick('可浏览', 'to browse') }}</small>
      </div>
      <div class="pb-strip__col">
        <b>{{ weekProducts.toLocaleString() }}</b>
        <span>{{ pick('本周上榜', 'On the board') }}</span>
        <small>{{ pick('本周获票产品', 'products with votes') }}</small>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pb-strip {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 0;
  margin: 0 0 18px;
  padding: 0;
  border: 1.5px dashed #d9dce2;
  border-radius: 20px;
  background: var(--card, #fff);
  overflow: hidden;
}
.pb-strip__main {
  position: relative;
  padding: 18px 22px 16px;
  min-height: 150px;
}
.pb-strip__main-top { display: flex; align-items: center; }
.pb-strip__label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #6b7280;
}
.pb-strip__label i {
  width: 8px; height: 8px; border-radius: 50%;
  background: #22a544;
}
.pb-strip__big {
  margin: 8px 0 0;
  font-size: 42px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}
.pb-strip__hint {
  margin: 4px 0 0;
  font-size: 13px;
  color: #6b7280;
}
.pb-strip__spark {
  position: absolute;
  right: 18px;
  bottom: 30px;
  width: 46%;
  height: 64px;
  opacity: 0.9;
}
.pb-strip__area { fill: rgba(249, 115, 22, 0.12); }
.pb-strip__line { stroke: #f97316; stroke-width: 2.4; vector-effect: non-scaling-stroke; }
.pb-strip__dot { fill: #f97316; }
.pb-strip__spark-empty {
  position: absolute;
  right: 18px; bottom: 40px;
  font-size: 11px; color: #9ca3af; max-width: 45%; text-align: right;
}
.pb-strip__axis {
  position: absolute;
  left: 22px; right: 18px; bottom: 12px;
  display: flex; justify-content: space-between;
  margin: 0;
  font-size: 10px;
  color: #9ca3af;
}
.pb-strip__cols {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-left: 1px solid #e5e7eb;
}
.pb-strip__col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 18px 8px;
  text-align: center;
  border-right: 1px solid #e5e7eb;
}
.pb-strip__col:last-child { border-right: 0; }
.pb-strip__col b {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
}
.pb-strip__col span {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
}
.pb-strip__col small {
  margin-top: 3px;
  font-size: 10px;
  color: #9ca3af;
  line-height: 1.3;
}
@media (max-width: 760px) {
  .pb-strip { grid-template-columns: 1fr; }
  .pb-strip__cols { border-left: 0; border-top: 1px solid #e5e7eb; }
  .pb-strip__spark { width: 40%; }
}
</style>
