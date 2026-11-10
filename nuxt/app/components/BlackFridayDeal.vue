<script setup lang="ts">
/**
 * Pricing promo card. Prices come from `effectiveQuote`, the same function
 * checkout uses. The countdown runs only while that campaign clock parses
 * and is still open. There is no painted 00:00:00.
 */
import {
  campaignActive,
  campaignClockMs,
  campaignDeadlineShanghai,
} from '~~/shared/content/campaign'
import { remainingDhms } from '~~/shared/utils/directory-window'
import { effectiveQuote, type EffectiveQuote } from '~~/shared/utils/pricing-effective'

const { pick } = useLang()
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

const live = computed(() => campaignActive(now.value))
const clockMs = campaignClockMs()
const ticking = computed(() => live.value && clockMs != null)
const left = computed(() => (clockMs == null ? null : remainingDhms(clockMs, now.value)))
const deadline = campaignDeadlineShanghai()

onMounted(() => {
  if (!ticking.value) return
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

type Cell = {
  id: string
  name: string
  quote: EffectiveQuote
  from?: boolean
  badge?: string
}

const cells = computed<Cell[]>(() => {
  const at = now.value
  return [
    { id: 'standard', name: pick('标准', 'Standard'), quote: effectiveQuote('listing', 'standard', at) },
    {
      id: 'featured',
      name: pick('精选', 'Featured'),
      quote: effectiveQuote('listing', 'featured', at),
      badge: pick('最多人选', 'Most picked'),
    },
    { id: 'pro', name: 'Pro', quote: effectiveQuote('listing', 'pro', at) },
    {
      id: 'billboard',
      name: 'Billboard',
      quote: effectiveQuote('billboard', 'floor', at),
      from: true,
    },
  ]
})

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

const floorLabel = computed(() => effectiveQuote('billboard', 'floor', now.value).priceLabel)

const units = computed(() => {
  const value = left.value
  if (!value) return []
  return [
    { n: pad(value.d), label: pick('天', 'Days') },
    { n: pad(value.h), label: pick('时', 'Hours') },
    { n: pad(value.m), label: pick('分', 'Min') },
    { n: pad(value.s), label: pick('秒', 'Sec') },
  ]
})
</script>

<template>
  <section id="black-friday" class="bf-deal" aria-labelledby="bf-deal-title">
    <div class="bf-deal__badges">
      <span class="bf-deal__badge">{{ pick('上线定价', 'LAUNCH PRICING') }}</span>
      <span v-if="live" class="bf-deal__live">{{ pick('进行中', 'Live now') }}</span>
    </div>

    <div class="bf-deal__grid">
      <div class="bf-deal__copy">
        <template v-if="live">
          <h2 id="bf-deal-title" class="bf-deal__h1">{{ pick('上线定价', 'Launch pricing') }}</h2>
          <p class="bf-deal__h2">{{ pick('收录档与右栏', 'on listings and the sidebar') }}</p>
          <p class="bf-deal__sub">
            {{
              pick(
                `页上标价即实付。截止 ${deadline}（上海时间）。Billboard 从 ${floorLabel} 起。冷启动地板，此前从 $15 起。`,
                `The price on the page is what you pay. Ends ${deadline} Asia/Shanghai. Billboard is from ${floorLabel}. Cold-start floor; was from $15.`,
              )
            }}
          </p>
        </template>
        <template v-else>
          <h2 id="bf-deal-title" class="bf-deal__h2 bf-deal__h2--solo">
            {{ pick('页上标价即实付。', 'The price on the page is what you pay.') }}
          </h2>
          <p class="bf-deal__sub">
            {{
              pick(
                `Billboard 从 ${floorLabel} 起，一次付清。冷启动地板，此前从 $15 起。`,
                `Billboard is name-your-price from ${floorLabel}. Cold-start floor; was from $15.`,
              )
            }}
          </p>
        </template>
        <a class="bf-deal__cta" href="#plans">
          {{ pick('索取发票 · 查看优惠', 'Request invoice · See deals') }}
        </a>
        <p class="bf-deal__micro">{{ pick('无需优惠码', 'No code needed') }}</p>
      </div>

      <div class="bf-deal__side">
        <p class="bf-deal__ends">{{ pick('距结束', 'Ends in') }}</p>
        <ol v-if="ticking" class="bf-deal__timer" aria-live="polite">
          <li v-for="unit in units" :key="unit.label">
            <b>{{ unit.n }}</b>
            <span>{{ unit.label }}</span>
          </li>
        </ol>
        <p v-else class="bf-deal__empty">
          {{
            pick(
              '见下方截止日期。有活动时钟才显示倒计时。',
              'Ends on the date below — live countdown when the clock source is on.',
            )
          }}
        </p>

        <ul class="bf-deal__prices">
          <li v-for="cell in cells" :key="cell.id">
            <span class="bf-deal__name">
              {{ cell.name }}
              <em v-if="cell.badge">{{ cell.badge }}</em>
            </span>
            <span class="bf-deal__amount">
              <template v-if="cell.from">
                <small>{{ pick('从', 'from') }}</small>
                {{ cell.quote.priceLabel }}
              </template>
              <template v-else>
                <s v-if="cell.quote.strikeLabel">{{ cell.quote.strikeLabel }}</s>
                {{ cell.quote.priceLabel }}
              </template>
            </span>
          </li>
        </ul>
        <p class="bf-deal__floor">
          {{
            pick(
              `Billboard：从 ${floorLabel} 起 · 冷启动地板，此前从 $15 起 · 步进 +$1`,
              `Billboard: from ${floorLabel} · cold-start floor; was from $15 · bid step +$1`,
            )
          }}
        </p>
        <p class="bf-deal__fine">
          {{
            pick(
              '发票确认后上线。不承诺搜索排名、流量或域名权重。',
              'Invoice confirmed → goes live. No promise of search rank, traffic, or DR.',
            )
          }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bf-deal {
  margin: 0 0 28px;
  padding: 28px 28px 24px;
  border-radius: 28px;
  color: #f6f1e7;
  background:
    radial-gradient(1200px 280px at 10% -10%, rgba(245, 196, 81, 0.18), transparent 55%),
    linear-gradient(145deg, #1a140c 0%, #0e0c0a 55%, #2a1c10 100%);
  box-shadow: 0 20px 50px rgba(20, 12, 4, 0.28);
  scroll-margin-top: 96px;
}
.bf-deal__badges { display: flex; gap: 8px; align-items: center; }
.bf-deal__badge,
.bf-deal__live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.bf-deal__badge { background: #3a2a12; color: #f5c451; }
.bf-deal__live { background: #14241a; color: #86efac; }
.bf-deal__live::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #4ade80;
}
.bf-deal__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 28px;
  margin-top: 22px;
  align-items: start;
}
.bf-deal__eye {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #d6d3d1;
}
.bf-deal__h1 {
  margin: 4px 0 0;
  font-size: clamp(40px, 5vw, 64px);
  line-height: 0.95;
  letter-spacing: -0.04em;
  background: linear-gradient(180deg, #ffe7a3 0%, #f5c451 45%, #d97706 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.bf-deal__h2 { margin: 8px 0 0; font-size: 22px; font-weight: 750; }
.bf-deal__h2--solo { font-size: 28px; letter-spacing: -0.02em; }
.bf-deal__sub { margin: 12px 0 0; max-width: 38rem; color: #d6d3d1; font-size: 14px; line-height: 1.5; }
/* `#black-friday` is required. Pricing lives in `.src-page`, whose link reset
   is `:is(.src-page, body > :not(#__nuxt)) a { color: revert-layer }`. The
   `#__nuxt` argument raises that rule above a plain class, so the label was
   inheriting the card's cream (#f6f1e7) onto this white pill. */
#black-friday .bf-deal__cta {
  display: inline-flex;
  margin-top: 18px;
  padding: 12px 18px;
  border-radius: 999px;
  background: #fff;
  color: #14120f;
  font-weight: 800;
  text-decoration: none;
}
.bf-deal__micro { margin: 10px 0 0; color: #a8a29e; font-size: 13px; }
.bf-deal__micro::before { content: '✓ '; color: #86efac; }
.bf-deal__ends {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #d6d3d1;
}
.bf-deal__timer {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
}
.bf-deal__timer li {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 14px;
  padding: 10px 6px 8px;
  text-align: center;
}
.bf-deal__timer b { display: block; font-size: 26px; letter-spacing: -0.03em; }
.bf-deal__timer span { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #a8a29e; }
.bf-deal__empty {
  margin: 0 0 14px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: #e7e5e4;
  font-size: 14px;
}
.bf-deal__prices { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.bf-deal__prices li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.bf-deal__name { font-weight: 750; }
.bf-deal__name em {
  margin-left: 6px;
  font-style: normal;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: #1c1408;
  background: #f5c451;
  border-radius: 999px;
  padding: 2px 6px;
}
.bf-deal__amount { font-weight: 800; font-variant-numeric: tabular-nums; }
.bf-deal__amount small { margin-right: 4px; font-size: 12px; font-weight: 650; color: #d6d3d1; }
.bf-deal__amount s { margin-right: 6px; color: #a8a29e; font-weight: 600; }
.bf-deal__floor,
.bf-deal__fine { margin: 10px 0 0; color: #a8a29e; font-size: 12px; line-height: 1.45; }
@media (max-width: 800px) {
  .bf-deal { padding: 22px 16px 18px; }
  .bf-deal__grid { grid-template-columns: 1fr; }
  .bf-deal__h1 { font-size: 40px; }
}
</style>
