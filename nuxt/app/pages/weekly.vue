<script setup lang="ts">
const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const { categories: liveCategories } = useDirectoryMeta()

// The board slot is sold as "one row inside the leaderboard, after third
// place". Nothing booked means no row at all.
const { board: boardAd } = await useAds()

const archive = computed(() =>
  [...weeks].sort((a, b) => (a.id < b.id ? 1 : -1)),
)

/**
 * Panels are the current period followed by the archived weeks, newest first.
 *
 * The newest archive (2026-W44) has no tab on the live page — the "current"
 * panel already carries those vote totals, because `votes_week` is the last
 * completed week. So the tab row starts at the second-newest archive, and the
 * change column for that one is computed against the archive after it.
 *
 * For the current period there is no archive row, so its ranking comes from
 * `votes_week`, the same numbers the homepage board shows. The live build
 * renders that panel as all-zero because its votes table has no rows for the
 * open week; showing zeros would contradict the homepage, so the real weekly
 * totals are used instead.
 */
type Panel = {
  key: string
  label: string
  current: boolean
  rows: {
    rank: number
    slug: string
    votes: number
    move: { kind: 'new' | 'up' | 'down' | 'flat'; delta: number }
  }[]
}

function rankOf(week: (typeof weeks)[number] | undefined) {
  const map = new Map<string, number>()
  if (!week) return map
  week.ranking.forEach((row, i) => map.set(row.slug, i + 1))
  return map
}

/**
 * The open week has no archive row, so its label is built here. The live page
 * prints it without the year ("Nov 2 – Nov 8") and appends the ISO week id in
 * the stat line only.
 */
function currentRange(locale: 'en' | 'zh'): string {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(monday.getDate() - ((monday.getDay() || 7) - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  if (locale === 'zh') {
    return `${monday.getMonth() + 1} 月 ${monday.getDate()} 日 – ${sunday.getMonth() + 1} 月 ${sunday.getDate()} 日`
  }
  const mon = monday.toLocaleString('en-US', { month: 'short' })
  const sun = sunday.toLocaleString('en-US', { month: 'short' })
  return `${mon} ${monday.getDate()} – ${sun} ${sunday.getDate()}`
}

const currentId = computed(() => isoWeekId())
const currentLabel = computed(() => currentRange(lang.value))

const panels = computed<Panel[]>(() => {
  const list: Panel[] = []

  const live = [...tools]
    .map((t) => ({ slug: t.slug, votes: t.votes_week }))
    .sort((a, b) => b.votes - a.votes)
  const liveRows = live.map((row, i) => ({
    rank: i + 1,
    slug: row.slug,
    votes: row.votes,
    move: { kind: 'flat' as const, delta: 0 },
  }))

  list.push({
    key: 'current',
    label: `${currentLabel.value} · ${pick('本周', 'current')}`,
    current: true,
    rows: liveRows,
  })

  archive.value.slice(1).forEach((week, i) => {
    const prev = rankOf(archive.value[i + 2])
    const rows = week.ranking.map((row, idx) => {
      const rank = idx + 1
      const before = prev.get(row.slug)
      const move = before === undefined
        ? { kind: 'new' as const, delta: 0 }
        : before === rank
          ? { kind: 'flat' as const, delta: 0 }
          : before > rank
            ? { kind: 'up' as const, delta: before - rank }
            : { kind: 'down' as const, delta: rank - before }
      return { rank, slug: row.slug, votes: row.votes, move }
    })
    list.push({ key: week.id, label: weekLabel(week, lang.value), current: false, rows })
  })

  return list
})

const active = ref(0)
const panel = computed(() => panels.value[active.value] ?? panels.value[0]!)

const title = computed(() => pick('本周产品榜', 'Weekly product leaderboard'))
const lead = computed(() =>
  pick(
    '每周一重置，按登录用户的投票数排名。付费置顶在首页优先展示，但不影响这里的票数排名。',
    'Resets every Monday. Ranked by votes from signed-in users. Paid placements are pinned on the homepage but do not affect this ranking.',
  ),
)

useSeo({
  title: computed(() => `${title.value} · Product Atlas`),
  description: lead,
})
</script>

<template>
  <div class="container">
    <nav class="breadcrumb" :aria-label="pick('面包屑', 'breadcrumb')">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" />
      <span>{{ pick('周榜', 'Weekly') }}</span>
    </nav>

    <header class="page-head">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-sub">{{ lead }}</p>
      <p class="stat-line" style="margin-top: 8px">
        {{ pick('当前周期：', 'Current period：') }}{{ currentLabel }} · {{ currentId }}
      </p>
    </header>

    <nav class="tab-nav tab-nav--weeks" :aria-label="pick('周榜', 'Weekly')">
      <button
        v-for="(item, i) in panels"
        :key="item.key"
        class="pill"
        :class="{ 'is-active': i === active }"
        type="button"
        :aria-selected="i === active"
        @click="active = i"
      >
        {{ item.label }}
      </button>
    </nav>

    <div class="week-panel is-active">
      <table class="rank-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{{ pick('工具', 'Tool') }}</th>
            <th>{{ pick('分类', 'Categories') }}</th>
            <th>{{ pick('变化', 'Change') }}</th>
            <th>{{ pick('本周票数', 'Votes') }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(row, i) in panel.rows" :key="row.slug">
            <tr>
              <td class="rank-num">{{ row.rank }}</td>
              <td>
                <NuxtLink class="rank-tool" :to="localePath(`/tools/${row.slug}`)">
                  <span class="tool-icon" style="width: 32px; height: 32px">
                    <img
                      :src="`/${toolBySlug(row.slug, lang)?.logo ?? `assets/img/icons/${row.slug}.png`}`"
                      alt=""
                      width="32"
                      height="32"
                      loading="lazy"
                    >
                  </span>
                  <span>
                    <strong>{{ toolBySlug(row.slug, lang)?.name ?? row.slug }}</strong>
                    <em>{{ toolBySlug(row.slug, lang)?.short }}</em>
                  </span>
                </NuxtLink>
              </td>
              <td class="rank-cat">
                <span v-if="categoryBySlug(toolBySlug(row.slug, lang)?.category ?? '', liveCategories)" class="chip">
                  {{ localizeCategory(categoryBySlug(toolBySlug(row.slug, lang)!.category, liveCategories)!, lang).name }}
                </span>
              </td>
              <td class="rank-move-cell">
                <span v-if="row.move.kind === 'new'" class="rank-move is-new">NEW</span>
                <span v-else-if="row.move.kind === 'up'" class="rank-move is-up">▲{{ row.move.delta }}</span>
                <span v-else-if="row.move.kind === 'down'" class="rank-move is-down">▼{{ row.move.delta }}</span>
                <span v-else class="rank-move">—</span>
              </td>
              <td class="rank-votes">
                <span class="vote vote--sm is-static">
                  <Icon name="arrow-up" />
                  <span>{{ row.votes }}</span>
                </span>
              </td>
            </tr>

            <!-- The board slot: one row, after third place, sold by the week. -->
            <tr v-if="i === 2 && boardAd" class="rank-ad">
              <td colspan="5">
                <a
                  class="rank-ad__link"
                  :href="boardAd.url"
                  rel="sponsored nofollow noopener"
                  target="_blank"
                >
                  <span class="rank-ad__tag">Sponsored</span>
                  <strong>{{ boardAd.name }}</strong>
                  <em>{{ boardAd.headline }}</em>
                  <span class="rank-ad__cta">Learn more →</span>
                </a>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* The board slot only exists while a campaign is booked, so none of this is
   reachable in the default state — the row is simply absent. */
.rank-ad td {
  padding: 0;
  background: color-mix(in oklab, var(--accent) 55%, transparent);
}

.rank-ad__link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  color: inherit;
  text-decoration: none;
}

.rank-ad__tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: color-mix(in oklab, var(--amber) 18%, transparent);
  color: color-mix(in oklab, var(--amber) 70%, black);
}

.rank-ad__link strong {
  flex-shrink: 0;
  font-size: 14px;
}

.rank-ad__link em {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-style: normal;
  color: var(--muted-foreground);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-ad__cta {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
}
</style>
