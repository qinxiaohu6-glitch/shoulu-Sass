<script setup lang="ts">
/**
 * The board's number strip — the row of figures under the week switcher.
 *
 * Shaped like the leaderboard's traffic header (one big figure with a trend
 * line, three tallies behind dividers), because that is the reading order a
 * visitor already knows from every other launch board.
 *
 * What is NOT here: "page views / 24h". We do not run visitor analytics, so a
 * traffic figure would have to be invented. The big number is the one we can
 * count — the directory's size — and the line behind it is the same number
 * week by week, ending on today. The three tallies are the site's activity
 * (reviews completed, how long a review takes, how many categories there are).
 *
 * The panel used to lead with "N listed this week", which is 0 every Monday
 * morning: the open week has no launches yet, so the whole strip read as a
 * dead site. Cumulative listings cannot be 0, and the line tells the same
 * story as the number.
 */
const { isZh, pick } = useLang()

const totals = ref<{
  products: number
  categories: number
  reviews: number
  median: number | null
} | null>(null)
/** Oldest → newest, six ISO weeks; the last entry is the open week. */
const launchWeeks = ref<{ id: string; listed: number }[]>([])

// Fetched on the server so the strip is in the HTML; hidden if the read fails.
const requestFetch = useRequestFetch()
try {
  const stats = await requestFetch<{
    ok: boolean
    products?: number
    categories?: number
    reviewed_last_30d?: number
    median_review_days?: number | null
    launch_weeks?: { id: string; listed: number }[]
  }>('/api/stats')
  if (stats?.ok) {
    totals.value = {
      products: stats.products ?? 0,
      categories: stats.categories ?? 0,
      reviews: stats.reviewed_last_30d ?? 0,
      median: stats.median_review_days ?? null,
    }
    launchWeeks.value = stats.launch_weeks ?? []
  }
} catch {
  // leave null → the template prints an em dash instead of a confident 0
}

/**
 * Cumulative listings per week, oldest → newest.
 *
 * The six weeks the API returns may not cover the whole directory — anything
 * listed before that window is the starting value, so the last point always
 * equals the number printed above it. A chart whose endpoint disagreed with
 * the headline figure would be worse than no chart.
 */
const series = computed(() => {
  const weeks = launchWeeks.value
  const total = totals.value?.products
  if (!weeks.length || total === undefined) return []
  const sum = weeks.reduce((n, week) => n + week.listed, 0)
  let run = Math.max(0, total - sum)
  return weeks.map((week) => (run += week.listed))
})

const points = computed(() => {
  const s = series.value
  if (s.length < 2) return []
  const max = Math.max(...s)
  const min = Math.min(...s)
  const span = max - min || 1
  return s.map((v, i) => {
    const x = 2 + (i * 296) / (s.length - 1)
    const y = 62 - ((v - min) / span) * 52
    return [Number(x.toFixed(1)), Number(y.toFixed(2))] as const
  })
})

const clampY = (v: number) => Math.max(0, Math.min(70, v))

/** Catmull-Rom → cubic bezier: the soft curve the competitor's chart uses. */
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length < 2) return ''
  let d = `M${pts[0]![0]},${pts[0]![1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = clampY(p1[1] + (p2[1] - p0[1]) / 6)
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = clampY(p2[1] - (p3[1] - p1[1]) / 6)
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return d
}

/** Line, filled area and the end dot in a 300×70 box; null without a trend. */
const spark = computed(() => {
  const pts = points.value
  if (pts.length < 2) return null
  const line = smoothPath(pts)
  const last = pts[pts.length - 1]!
  const first = pts[0]!
  return { line, area: `${line} L${last[0]},70 L${first[0]},70 Z`, dot: last }
})
</script>

<template>
  <section class="pb-strip" aria-label="Board numbers">
    <div class="pb-strip__main">
      <div class="pb-strip__main-top">
        <span class="pb-strip__label"><i />{{ pick('已收录', 'IN THE DIRECTORY') }}</span>
      </div>
      <p class="pb-strip__big">{{ totals ? totals.products.toLocaleString() : '—' }}</p>
      <p class="pb-strip__hint">
        {{ isZh ? '个产品已收录' : 'products listed' }}
      </p>
      <svg
        v-if="spark"
        class="pb-strip__spark"
        viewBox="0 0 300 70"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="pb-strip-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f97316" stop-opacity="0.30" />
            <stop offset="100%" stop-color="#f97316" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path class="pb-strip__area" :d="spark.area" />
        <path class="pb-strip__line" :d="spark.line" fill="none" />
        <circle class="pb-strip__dot" :cx="spark.dot[0]" :cy="spark.dot[1]" r="3.5" />
      </svg>
      <p v-else class="pb-strip__spark-empty">
        {{ pick('满两周后出现趋势', 'Trend appears after two weeks') }}
      </p>
      <p class="pb-strip__axis">
        <span>{{ pick('6 周前', '6 weeks ago') }}</span>
        <span>{{ pick('现在', 'Now') }}</span>
      </p>
    </div>
    <!-- Three tallies, not two: the strip had a wide empty band in the middle
         and printed "0 votes this week" on the left of it every Monday. These
         three answer "is this place alive" without a single zero in the row. -->
    <div class="pb-strip__cols">
      <div class="pb-strip__col">
        <b>{{ totals ? totals.reviews.toLocaleString() : '—' }}</b>
        <span>{{ pick('近 30 天审核', 'Reviews · 30d') }}</span>
        <small>{{ pick('已完成', 'completed') }}</small>
      </div>
      <div class="pb-strip__col">
        <b :class="{ 'is-empty': !totals || totals.median === null }">
          {{ totals && totals.median !== null ? totals.median.toFixed(1) : '—' }}
          <u v-if="totals && totals.median !== null">{{ pick('天', 'd') }}</u>
        </b>
        <span>{{ pick('中位审核', 'Median review') }}</span>
        <small>{{ pick('提交到上线', 'submit to live') }}</small>
      </div>
      <div class="pb-strip__col">
        <b>{{ totals ? totals.categories.toLocaleString() : '—' }}</b>
        <span>{{ pick('分类', 'Categories') }}</span>
        <small>{{ pick('全站', 'site-wide') }}</small>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Two blocks, not four: `.pb-strip__cols` is its own three-column grid, so the
   outer track list is "the figure" + "the tallies". Listing four tracks here
   put the whole tallies block in one 0.82fr track and squeezed the labels into
   one character per line. */
.pb-strip {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 2.5fr);
  gap: 0;
  margin: 0 0 18px;
  padding: 0;
  border: 1.5px dashed #e0e3e9;
  border-radius: 20px;
  background: var(--card, #fff);
  overflow: hidden;
}
/* The figure block is ~200px wide here — the homepage keeps two rails, so the
   centre column is nothing like the competitor's full-width header. A chart
   laid beside the number at that width covers the caption, so the block is a
   vertical stack instead: label, figure, caption, line, axis. */
.pb-strip__main {
  display: flex;
  flex-direction: column;
  padding: 18px 18px 12px;
}
.pb-strip__main-top { display: flex; align-items: center; }
.pb-strip__label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #8b9099;
}
.pb-strip__label i {
  width: 7px; height: 7px; border-radius: 50%;
  background: #22a544;
}
.pb-strip__big {
  margin: 10px 0 0;
  font-size: 46px;
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.pb-strip__hint {
  margin: 6px 0 0;
  font-size: 13px;
  color: #6b7280;
}
.pb-strip__spark {
  width: 100%;
  height: 62px;
  margin-top: auto;
  padding-top: 8px;
  overflow: visible;
}
.pb-strip__area { fill: url(#pb-strip-fill); }
.pb-strip__line { stroke: #f97316; stroke-width: 2.4; vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
.pb-strip__dot { fill: #f97316; }
.pb-strip__spark-empty {
  margin: auto 0 0;
  padding-top: 10px;
  font-size: 11px;
  color: #9ca3af;
}
.pb-strip__axis {
  display: flex;
  justify-content: space-between;
  margin: 4px 0 0;
  font-size: 10.5px;
  color: #9ca3af;
}
.pb-strip__cols {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-left: 1px solid #eef0f3;
}
.pb-strip__col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 8px;
  text-align: center;
  border-right: 1px solid #eef0f3;
}
.pb-strip__col:last-child { border-right: 0; }
.pb-strip__col b {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.pb-strip__col b u {
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  color: #6b7280;
}
/* A missing median is not a zero: an em dash at 32px/800 reads as a black bar. */
.pb-strip__col b.is-empty { font-size: 26px; color: #c4c8cf; }
.pb-strip__col span {
  margin-top: 10px;
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.25;
}
.pb-strip__col small {
  margin-top: 4px;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.35;
}
@media (max-width: 760px) {
  .pb-strip { grid-template-columns: 1fr; }
  .pb-strip__cols { border-left: 0; border-top: 1px solid #eef0f3; }
  .pb-strip__spark { height: 56px; }
  .pb-strip__col { padding: 14px 6px; }
  .pb-strip__col b { font-size: 24px; }
}
</style>
