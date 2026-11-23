<script setup lang="ts">
/**
 * The board's traffic strip — the row of figures above the feed.
 *
 * It is a traffic header, not a directory summary. The strip used to lead with
 * "N products listed" and three tallies about our own review queue: true, and
 * worth nothing to the reader. A visitor deciding whether to list a product
 * here, and a buyer deciding whether to pay for a slot, both ask the same
 * question — is anyone actually on this site? — so the strip answers that and
 * nothing else.
 *
 * The figures are measured. `server/middleware/10-traffic.ts` counts one page
 * view per human request into `traffic_hour` (one row per UTC hour) and one
 * visitor row per day keyed by a salted hash that rotates with the day. There
 * is no analytics vendor and no per-person history: two `COUNT`s and a `SUM`.
 *
 * Two states matter as much as the numbers:
 *  - nothing counted yet → em dash, not a confident 0, plus a note saying the
 *    counter starts today. "Nobody came" and "we started an hour ago" are
 *    different statements and the page must not confuse them;
 *  - counted, but a quiet 24 hours → the real 0, with the line flat on the
 *    baseline. An honest zero is the price of the figure being worth anything.
 */
const { pick } = useLang()

type Traffic = {
  /** 24 numbers, oldest → newest, ending on the current hour. */
  hourly: number[]
  views_24h: number
  visitors_today: number
  views_week: number
  live_now: number
  peak: number
  has_data: boolean
}

const requestFetch = useRequestFetch()
// Fetched through `useAsyncData` so the server-rendered figures arrive with the
// HTML and are not re-fetched (and re-rendered with different values) during
// hydration. A failed read leaves it null and the strip prints em dashes.
const { data: payload } = await useAsyncData('board-traffic', async () => {
  try {
    return await requestFetch<{ ok: boolean; traffic?: Traffic }>('/api/stats')
  } catch {
    return null
  }
})

const traffic = computed(() => (payload.value?.ok ? (payload.value.traffic ?? null) : null))
const hourly = computed(() => traffic.value?.hourly ?? [])
const hasData = computed(() => traffic.value?.has_data === true)

/** One figure, or an em dash while the counter has nothing to report. */
function figure(value: number | undefined): string {
  if (!hasData.value || value === undefined || !Number.isFinite(value)) return '—'
  return value.toLocaleString()
}

const live = computed(() => (hasData.value ? (traffic.value?.live_now ?? 0) : 0))

/**
 * The line, anchored at zero.
 *
 * Not min/max scaled: a single view must not stretch into a mountain range,
 * and a quiet hour has to sit on the baseline where it belongs. Only the
 * busiest hour of the window reaches the top.
 */
const points = computed(() => {
  const series = hourly.value
  if (series.length < 2) return []
  const max = Math.max(...series, 1)
  return series.map((value, i) => {
    const x = 2 + (i * 296) / (series.length - 1)
    const y = 62 - (Math.max(0, value) / max) * 52
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
  if (!pts.length || !hasData.value) return null
  const line = smoothPath(pts)
  const last = pts[pts.length - 1]!
  const first = pts[0]!
  return { line, area: `${line} L${last[0]},70 L${first[0]},70 Z`, dot: last }
})

/** Why the line is missing — the two reasons are not the same sentence. */
const emptyNote = computed(() => {
  if (!hasData.value) {
    return pick(
      '统计从今天开始，24 小时后出现曲线',
      'Counting starts today — the line appears within 24 hours',
    )
  }
  return pick('最近 24 小时没有访问', 'No visits in the last 24 hours')
})
</script>

<template>
  <section class="pb-strip" aria-label="Site traffic">
    <div class="pb-strip__main">
      <div class="pb-strip__main-top">
        <span class="pb-strip__label">{{ pick('24 小时流量', '24H TRAFFIC') }}</span>
        <!-- Only when someone is here: "0 live" is a reason to leave. -->
        <span v-if="live > 0" class="pb-strip__live">
          <i />
          {{ live }} {{ pick('在线', 'live') }}
        </span>
      </div>
      <p class="pb-strip__big">{{ figure(traffic?.views_24h) }}</p>
      <p class="pb-strip__hint">{{ pick('次页面浏览 / 24 小时', 'page views / 24h') }}</p>
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
      <p v-else class="pb-strip__spark-empty">{{ emptyNote }}</p>
      <p class="pb-strip__axis">
        <span>{{ pick('24 小时前', '24h ago') }}</span>
        <span>{{ pick('现在', 'Now') }}</span>
      </p>
    </div>
    <!-- Three tallies behind dividers, like the leaderboard header this copies.
         All three are traffic, so the row reads as one subject instead of four
         unrelated counts. -->
    <div class="pb-strip__cols">
      <div class="pb-strip__col">
        <b>{{ figure(traffic?.visitors_today) }}</b>
        <span>{{ pick('今日访客', 'Visitors today') }}</span>
        <small>{{ pick('按日去重', 'unique') }}</small>
      </div>
      <div class="pb-strip__col">
        <b>{{ figure(traffic?.views_week) }}</b>
        <span>{{ pick('本周浏览', 'Views this week') }}</span>
        <small>{{ pick('周一起算', 'since Monday') }}</small>
      </div>
      <div class="pb-strip__col">
        <b>{{ figure(traffic?.peak) }}</b>
        <span>{{ pick('峰值小时', 'Peak hour') }}</span>
        <small>{{ pick('24 小时内', 'in 24h') }}</small>
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
.pb-strip__main-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 18px;
}
.pb-strip__label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #8b9099;
}
/* The one green thing on the strip: somebody is on the site right now. */
.pb-strip__live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #1a8f3c;
  white-space: nowrap;
}
.pb-strip__live i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22a544;
  box-shadow: 0 0 0 3px rgba(34, 165, 68, 0.16);
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
  line-height: 1.4;
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
