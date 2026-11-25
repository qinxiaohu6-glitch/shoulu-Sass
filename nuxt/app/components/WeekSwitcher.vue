<script setup lang="ts">
/**
 * The board's time machine — one week at a time.
 *
 * ProductsBoost shows only the selected week's launches and lets makers move
 * through time with arrows, a week ruler, and a calendar. We do the same:
 * every target is a `?year=&week=` link, the exact format `/api/board` already
 * accepts, so a selected week is server-rendered, shareable and back-button
 * friendly. No client-only state decides what the crawler sees.
 */
import { isoWeekId } from '~~/shared/utils/iso-week'
import { isoWeekStart, weekPresentation } from '~~/shared/utils/weekly-board'

const props = defineProps<{
  /** Active ISO week id, e.g. 2026-W47. */
  activeId: string
  /** Every week that has public listings, newest first. */
  weeks: string[]
}>()

const { isZh, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()

const active = computed(() => props.activeId)
const activeStart = computed(() => isoWeekStart(active.value))
const activeNum = computed(() => Number(active.value.split('-W')[1] ?? 0))
const activeYear = computed(() => Number(active.value.split('-W')[0] ?? 0))

/** The real current ISO week (today), independent of what is being viewed. */
const realCurrentWeek = computed(() => isoWeekId(new Date()))
const dataWeeks = computed(() => new Set(props.weeks))

function weekNum(id: string): number { return Number(id.split('-W')[1] ?? 0) }
function yearOf(id: string): number { return Number(id.split('-W')[0] ?? 0) }
/** Linear ordinal so past/future comparisons cross year boundaries safely. */
function ordinal(id: string): number { return yearOf(id) * 100 + weekNum(id) }
function idFromOrdinal(o: number): string {
  const y = Math.floor(o / 100)
  const w = o % 100
  return `${y}-W${String(w).padStart(2, '0')}`
}

/**
 * A continuous ruler: every week from the oldest listing to a few weeks past
 * the real current one. Past weeks with data are solid, the viewed week is the
 * big volt dot, and future weeks are hollow — the exact state language of the
 * competitor's time machine.
 */
const ruler = computed(() => {
  const ords = [ordinal(realCurrentWeek.value), ordinal(active.value), ...props.weeks.map(ordinal)]
  const min = Math.min(...ords)
  const max = Math.max(...ords) + 6
  const activeOrd = ordinal(active.value)
  const nowOrd = ordinal(realCurrentWeek.value)
  type Stop = { id: string; n: number; state: 'past' | 'active' | 'future'; reached: boolean; isNow: boolean; hasData: boolean }
  const out: Stop[] = []
  for (let o = min; o <= max; o++) {
    const id = idFromOrdinal(o)
    const n = weekNum(id)
    if (!n || n > 53) continue
    out.push({
      id,
      n,
      state: id === active.value ? 'active' : o < nowOrd ? 'past' : 'future',
      reached: o <= activeOrd,
      isNow: o === nowOrd,
      hasData: dataWeeks.value.has(id),
    })
  }
  return out
})

/** Month label shown above a tick only when the month changes. */
function monthLabel(id: string): string {
  const start = isoWeekStart(id)
  if (!start) return ''
  const en = start.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  const zh = `${start.getUTCMonth() + 1}月`
  return isZh.value ? zh : en
}
function showMonth(index: number): boolean {
  if (index === 0) return true
  return monthLabel(ruler.value[index]!.id) !== monthLabel(ruler.value[index - 1]!.id)
}

/** URL for a week id: competitor form ?year=2026&week=47. */
function weekTo(id: string) {
  return { path: localePath('/'), query: { ...route.query, year: String(yearOf(id)), week: String(weekNum(id)) } }
}

/** Neighbour week by ordinal; only weeks inside the ruler are reachable. */
function neighbour(delta: number): string | null {
  const found = ruler.value.find((w) => ordinal(w.id) === ordinal(active.value) + delta)
  return found?.id ?? null
}
const prevWeek = computed(() => neighbour(-1))
const nextWeek = computed(() => neighbour(1))

const presentation = computed(() => weekPresentation(active.value))
const isLive = computed(() => active.value === realCurrentWeek.value)
const title = computed(() =>
  isZh.value ? `第 ${weekNum(active.value)} 周` : `Week ${weekNum(active.value)}`,
)
const label = computed(() => {
  const p = presentation.value
  if (p) return isZh.value ? p.label_zh : p.label_en
  return active.value
})

/** ---- Full month calendar popover (competitor style) ---- */
const calendarOpen = ref(false)
const calendarButton = ref<HTMLButtonElement | null>(null)
function closeCalendar(restoreFocus = false) {
  if (!calendarOpen.value) return
  calendarOpen.value = false
  if (restoreFocus) nextTick(() => calendarButton.value?.focus())
}
/** The month the popover is showing (year, 0-based month). */
const calMonth = ref({ y: activeYear.value, m: (activeStart.value?.getUTCMonth() ?? 0) })
watch(active, () => {
  calMonth.value = { y: activeYear.value, m: (activeStart.value?.getUTCMonth() ?? 0) }
})

const WEEKDAYS = computed(() =>
  isZh.value ? ['一', '二', '三', '四', '五', '六', '日'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
)
const calTitle = computed(() => {
  const d = new Date(Date.UTC(calMonth.value.y, calMonth.value.m, 1))
  return d.toLocaleString(isZh.value ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'long', timeZone: 'UTC',
  })
})

type CalDay = { day: number; iso: string; weekId: string; hasData: boolean; isCurrentWeek: boolean; isActive: boolean; outside: boolean }
/** 42-cell Monday-first grid for the shown month. */
const calDays = computed<CalDay[]>(() => {
  const first = new Date(Date.UTC(calMonth.value.y, calMonth.value.m, 1))
  const mondayOffset = (first.getUTCDay() || 7) - 1
  const gridStart = new Date(first.getTime() - mondayOffset * 86_400_000)
  const days: CalDay[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getTime() + i * 86_400_000)
    const iso = d.toISOString().slice(0, 10)
    const weekId = isoWeekId(d)
    days.push({
      day: d.getUTCDate(),
      iso,
      weekId,
      hasData: dataWeeks.value.has(weekId),
      isCurrentWeek: weekId === realCurrentWeek.value,
      isActive: weekId === active.value,
      outside: d.getUTCMonth() !== calMonth.value.m,
    })
  }
  return days
})

function shiftMonth(delta: number) {
  const d = new Date(Date.UTC(calMonth.value.y, calMonth.value.m + delta, 1))
  calMonth.value = { y: d.getUTCFullYear(), m: d.getUTCMonth() }
}
/** A day navigates only if its week actually has listings. */
function pickDay(day: CalDay) {
  if (!day.hasData) return
  calendarOpen.value = false
  navigateTo(weekTo(day.weekId))
}
function goToday() {
  if (!dataWeeks.value.has(realCurrentWeek.value)) return
  calendarOpen.value = false
  navigateTo(weekTo(realCurrentWeek.value))
}

/** Close the popover on an outside click. */
function onDocClick(e: MouseEvent) {
  if (!calendarOpen.value) return
  const el = (e.target as HTMLElement)?.closest?.('.ws__calendar-wrap')
  if (!el) calendarOpen.value = false
}

/**
 * The rail is 16 stations wide (704px) but only ~330px fits on a phone, and it
 * scrolls with the scrollbar hidden — so the open week, which sits 9 stations
 * in, started off-screen: the strip looked like it was showing last month and
 * the one station you care about was invisible. Centre it on mount and resize.
 * On desktop the ruler fits whole and this leaves scrollLeft at 0.
 */
const railEl = ref<HTMLElement | null>(null)
function centreActiveWeek() {
  const el = railEl.value
  const active = el?.querySelector<HTMLElement>('.ws__stop.is-active')
  if (!el || !active) return
  const wrap = el.getBoundingClientRect()
  const cur = active.getBoundingClientRect()
  el.scrollLeft += cur.left - wrap.left - (wrap.width - cur.width) / 2
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  centreActiveWeek()
  window.addEventListener('resize', centreActiveWeek)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('resize', centreActiveWeek)
})
</script>

<template>
  <section class="ws" aria-label="Choose a week" @keydown.esc.stop.prevent="closeCalendar(true)">
    <div class="ws__nav">
      <NuxtLink
        v-if="prevWeek"
        class="ws__arrow"
        :to="weekTo(prevWeek)"
        :aria-label="pick('上一周', 'Previous week')"
      >‹</NuxtLink>
      <span v-else class="ws__arrow ws__arrow--off" aria-hidden="true">‹</span>

      <div class="ws__current">
        <p class="ws__title">
          {{ title }}
          <span v-if="isLive" class="ws__live"><i />{{ pick('本周', 'Live') }}</span>
        </p>
        <p class="ws__range">{{ label }}</p>
      </div>

      <NuxtLink
        v-if="nextWeek"
        class="ws__arrow"
        :to="weekTo(nextWeek)"
        :aria-label="pick('下一周', 'Next week')"
      >›</NuxtLink>
      <span v-else class="ws__arrow ws__arrow--off" aria-hidden="true">›</span>
    </div>

    <div ref="railEl" class="ws__ruler-wrap">
      <ol class="ws__ruler">
        <li
          v-for="(w, i) in ruler"
          :key="w.id"
          class="ws__stop"
          :class="[`is-${w.state}`, { 'is-reached': w.reached, 'is-now': w.isNow, 'has-data': w.hasData }]"
        >
          <span v-if="showMonth(i)" class="ws__month">{{ monthLabel(w.id) }}</span>
          <NuxtLink
            class="ws__stop-link"
            :to="weekTo(w.id)"
            :aria-label="`${pick('第', 'Week ')}${w.n}`"
            :aria-current="w.id === active ? 'page' : undefined"
          >
            <!-- the track segment entering this station -->
            <span class="ws__track" aria-hidden="true" />
            <span class="ws__halo" aria-hidden="true" />
            <span class="ws__node-slot"><span class="ws__node" aria-hidden="true"><i /></span></span>
            <span class="ws__num">{{ w.n }}</span>
          </NuxtLink>
        </li>
      </ol>
    </div>

    <div class="ws__calendar-wrap">
      <button
        ref="calendarButton"
        class="ws__calendar-btn"
        type="button"
        :aria-label="pick('从日历选择周', 'Pick a week from the calendar')"
        aria-controls="week-calendar-popover"
        :aria-expanded="calendarOpen"
        @click="calendarOpen = !calendarOpen"
      >
        <Icon name="calendar" />
      </button>
      <Transition name="week-calendar">
        <div v-if="calendarOpen" id="week-calendar-popover" class="ws__calendar-pop" @click.stop>
        <div class="cal__head">
          <button type="button" class="cal__nav" :aria-label="pick('上个月', 'Previous month')" @click="shiftMonth(-1)">‹</button>
          <strong>{{ calTitle }}</strong>
          <button type="button" class="cal__nav" :aria-label="pick('下个月', 'Next month')" @click="shiftMonth(1)">›</button>
        </div>
        <div class="cal__grid cal__grid--dow">
          <span v-for="(d, i) in WEEKDAYS" :key="`dow-${i}`">{{ d }}</span>
        </div>
        <div class="cal__grid">
          <button
            v-for="cell in calDays"
            :key="cell.iso"
            type="button"
            class="cal__day"
            :class="{
              'is-out': cell.outside,
              'is-active': cell.isActive,
              'has-data': cell.hasData,
              'is-current-week': cell.isCurrentWeek,
            }"
            :disabled="!cell.hasData"
            :title="cell.weekId"
            @click="pickDay(cell)"
          >
            <span v-if="cell.hasData" class="cal__trophy" aria-hidden="true">🏆</span>
            <span v-else-if="cell.isCurrentWeek && !cell.isActive" class="cal__live-dot" aria-hidden="true" />
            <b>{{ cell.day }}</b>
          </button>
        </div>
        <div class="cal__foot">
          <span><i class="cal__legend cal__legend--data">🏆</i>{{ pick('有结果', 'Results') }}</span>
          <span><i class="cal__legend cal__legend--live" />{{ pick('实时', 'Live') }}</span>
          <span><i class="cal__legend cal__legend--up" />{{ pick('未开始', 'Upcoming') }}</span>
          <button type="button" class="cal__today" @click="goToday">{{ pick('回到本周', 'Today') }}</button>
        </div>
        </div>
      </Transition>
    </div>
  </section>
</template>

<style scoped>
.ws {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: stretch;
  gap: 0;
  min-width: 0;
  padding: 8px 12px;
  margin: 0 0 14px;
  border: 1.5px dashed #e0e3e9;
  border-radius: 18px;
  background: var(--card, #fff);
}
.ws__nav { display: flex; align-items: center; gap: 2px; border-right: 1px solid #eef0f3; }
.ws__arrow {
  display: grid; place-items: center; flex: none;
  width: 34px; height: 34px;
  font-size: 20px; line-height: 1; color: var(--muted-foreground, #8b9099);
  text-decoration: none; border-radius: 10px; transition: background .15s, color .15s;
}
.ws__arrow:hover { background: #f4f4f5; color: var(--foreground, #1a1a1a); }
.ws__arrow--off { opacity: .3; pointer-events: none; }
.ws__current { min-width: 132px; padding: 2px 12px; display: flex; flex-direction: column; justify-content: center; }
.ws__title { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -0.015em; display: flex; align-items: center; gap: 8px; }
.ws__live {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px; border-radius: 999px; background: #d4f75a; color: #2f3b00;
  font-size: 10px; font-weight: 800; letter-spacing: .04em;
}
.ws__live i { width: 6px; height: 6px; border-radius: 50%; background: #3f4d00; }
.ws__range { margin: 4px 0 0; font-size: 11.5px; color: var(--muted-foreground, #6b7280); white-space: nowrap; }

/* ---- Transit-map rail: a continuous line with station stops ---- */
.ws__ruler-wrap { min-width: 0; overflow-x: auto; scrollbar-width: none; padding-top: 6px; }
.ws__ruler-wrap::-webkit-scrollbar { display: none; }
.ws__ruler { display: flex; align-items: flex-end; height: 100%; margin: 0; padding: 0; list-style: none; width: 100%; }
/* Stations share the available width instead of hugging the left: a ruler that
   stops two thirds of the way across reads as broken, not as "no more weeks". */
.ws__stop { position: relative; flex: 1 1 0; min-width: 44px; height: 100%; }

/* Month signposts above the line — bold, dark, like station-zone labels. */
.ws__month {
  position: absolute; top: 0; left: 7px;
  font-size: 9.5px; font-weight: 800; letter-spacing: .1em;
  color: #9aa0a8; white-space: nowrap;
}

/* Three fixed rows — air, the node band, the number — so a 22px active node and
   a 12px past node share one centre line. With bottom-aligned flex the big node
   sat 5px higher than its neighbours and the rail cut under the dots. */
.ws__stop-link {
  position: relative; display: grid;
  grid-template-rows: 1fr 22px 18px;
  justify-items: center; align-items: center;
  width: 100%; height: 100%;
  text-decoration: none; color: var(--muted-foreground, #9ca3af);
}
/* Explicit rows: the track and halo are absolute and take no row, so without
   `grid-row` the node slot landed in row 1 and the number in row 2 — which put
   the rail under the numbers instead of through the dots. */
.ws__node-slot { display: grid; place-items: center; width: 100%; height: 22px; grid-row: 2; }
.ws__num { grid-row: 3; }

/* The rail segment entering each station. Reached = saturated brand line;
   upcoming = faint dashed line. `calc` keeps it on the node band whatever the
   strip's height. */
.ws__track {
  position: absolute; top: calc(100% - 30.5px); left: 0; right: 0; height: 3px;
  background: repeating-linear-gradient(90deg, #dfe3ea 0 5px, transparent 5px 10px);
}
.ws__stop.is-reached .ws__track {
  background: linear-gradient(90deg, var(--primary, #b45309), color-mix(in oklab, var(--primary, #b45309) 72%, #f5c451));
}
/* Last reached stop closes the line with a soft cap. */
.ws__stop.is-active .ws__track { background: linear-gradient(90deg, color-mix(in oklab, var(--primary, #b45309) 78%, #f5c451), var(--primary, #b45309)); }

/* Station node: white core, dark ring, like a stop on a metro map. */
.ws__node {
  position: relative; z-index: 2; width: 12px; height: 12px; border-radius: 50%;
  background: #fff; border: 2.5px solid #a8aeb7; box-sizing: border-box;
  transition: transform .15s, border-color .15s;
}
.ws__node i { position: absolute; inset: 2px; border-radius: 50%; background: transparent; }
.ws__stop.is-reached .ws__node { border-color: var(--primary, #b45309); }
.ws__stop.is-reached.has-data .ws__node i { background: var(--primary, #b45309); }
.ws__stop.is-future .ws__node { border-color: #dde1e7; background: #fafbfc; }

/* Active station: big volt node with a pulsing halo and a station flag. */
.ws__stop.is-active .ws__node {
  width: 22px; height: 22px; border-color: #1a1a1a; background: #d4f75a;
  border-width: 3px; box-shadow: 0 0 0 3px #fff, 0 0 0 5px rgba(212,247,90,.55), 0 4px 10px rgba(0,0,0,.18);
}
.ws__stop.is-active .ws__node i { background: #1a1a1a; inset: 5px; }
.ws__halo { position: absolute; top: calc(100% - 40px); left: 50%; width: 22px; height: 22px; margin-left: -11px; border-radius: 50%; pointer-events: none; }
.ws__stop.is-active .ws__halo { animation: ws-pulse 2s ease-out infinite; }
@keyframes ws-pulse {
  0% { box-shadow: 0 0 0 0 rgba(212,247,90,.55); }
  70% { box-shadow: 0 0 0 12px rgba(212,247,90,0); }
  100% { box-shadow: 0 0 0 0 rgba(212,247,90,0); }
}

.ws__num { position: relative; font-size: 11px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
.ws__stop.is-reached .ws__num { color: #374151; }
.ws__stop.is-active .ws__num { color: #1a1a1a; font-weight: 850; font-size: 12.5px; }
.ws__stop.is-future .ws__num { color: #b9bec7; }
.ws__stop-link:hover .ws__node { transform: scale(1.2); }

/* "Now" marker: a small live pip beside the real current week's number. */
.ws__stop.is-now:not(.is-active) .ws__node { border-color: #16a34a; }
.ws__stop.is-now .ws__num::after {
  content: ''; position: absolute; top: -3px; right: -7px;
  width: 5px; height: 5px; border-radius: 50%; background: #16a34a;
}

.ws__calendar-wrap {
  position: relative; display: flex; align-items: center;
  padding-left: 12px; border-left: 1px solid #eef0f3;
}
.ws__calendar-btn {
  display: grid; place-items: center; width: 38px; height: 38px;
  border: 1px solid #e5e7eb; border-radius: 11px; background: var(--card, #fff);
  color: var(--muted-foreground, #6b7280); cursor: pointer;
  transition: background .15s, color .15s, border-color .15s;
}
.ws__calendar-btn:hover { background: #f7f7f8; color: var(--foreground, #1a1a1a); border-color: #d7dae0; }
.ws__calendar-pop {
  position: absolute; right: 0; top: calc(100% + 10px); z-index: 50;
  padding: 16px; border: 1px solid #e5e7eb; border-radius: 16px; background: var(--card, #fff);
  box-shadow: 0 16px 44px rgba(0,0,0,.16); width: 320px;
}
.week-calendar-enter-active,
.week-calendar-leave-active {
  transform-origin: top right;
  transition:
    opacity var(--motion-panel) var(--motion-ease-standard),
    transform var(--motion-panel) var(--motion-ease-emphasized);
}
.week-calendar-enter-from,
.week-calendar-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(.97);
}
.cal__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.cal__head strong { font-size: 14px; font-weight: 800; }
.cal__nav {
  display: grid; place-items: center; width: 30px; height: 30px;
  border: 1px solid #e5e7eb; border-radius: 8px; background: var(--card, #fff);
  font-size: 20px; line-height: 1; color: var(--muted-foreground); cursor: pointer;
}
.cal__nav:hover { background: #f4f4f5; color: var(--foreground); }
.cal__grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; }
.cal__grid--dow { margin-bottom: 4px; }
.cal__grid--dow span { font-size: 10px; font-weight: 700; color: var(--muted-foreground, #9ca3af); padding: 4px 0; }
.cal__day {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 38px; border: 0; border-radius: 9px; background: transparent; cursor: pointer;
  font-size: 12px; color: var(--foreground, #1a1a1a); font-variant-numeric: tabular-nums;
}
.cal__day b { position: relative; z-index: 1; }
.cal__day.is-out { color: #c4c8cf; }
.cal__day:disabled { cursor: default; }
.cal__day.has-data:not(:disabled):hover { background: #f4f4f5; }
.cal__day.is-active { background: #1a1a1a; color: #fff; }
.cal__day.is-active .cal__trophy { filter: none; }
.cal__trophy { position: absolute; top: 0; left: 2px; font-size: 10px; line-height: 1; }
.cal__live-dot {
  position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%);
  width: 5px; height: 5px; border-radius: 50%; background: #65a30d;
}
.cal__foot {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px;
  margin-top: 12px; padding-top: 12px; border-top: 1px solid #eef0f3; font-size: 10.5px; color: var(--muted-foreground);
}
.cal__foot > span { display: inline-flex; align-items: center; gap: 4px; }
.cal__legend { font-style: normal; display: inline-block; }
.cal__legend--live, .cal__legend--up { width: 7px; height: 7px; border-radius: 50%; }
.cal__legend--live { background: #65a30d; }
.cal__legend--up { background: transparent; border: 1.5px solid #c4c8cf; }
.cal__today {
  margin-left: auto; padding: 5px 10px; border: 1px solid #e5e7eb; border-radius: 8px;
  background: var(--card, #fff); font-size: 11px; font-weight: 700; color: var(--foreground); cursor: pointer;
}
.cal__today:hover { background: #f4f4f5; }

/* Stacked under 640px. Keeping the three columns on a 390px screen gave the
   rail ~80px of a 358px strip: two stations visible out of five, the rest
   scrolled off behind a hidden scrollbar, with the calendar crowding the edge.
   Title row on top, the rail takes the full width underneath. */
@media (max-width: 640px) {
  .ws {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'nav cal' 'ruler ruler';
    row-gap: 2px;
  }
  .ws__nav { grid-area: nav; border-right: 0; }
  /* Explicit height: the ruler is `height:100%`, so in a row sized by its own
     content it would resolve to auto and collapse the month-label band. */
  .ws__ruler-wrap { grid-area: ruler; height: 54px; padding-top: 2px; }
  /* A hard cut at both edges reads as clipping; the fade reads as "more weeks
     that way", which is what the hidden-scrollbar rail actually is. */
  .ws__ruler-wrap {
    mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
  }
  .ws__calendar-wrap { grid-area: cal; border-left: 0; padding-left: 0; }
  .ws__current { min-width: 96px; padding: 4px 8px; }
  .ws__range { font-size: 10px; }
}
</style>
