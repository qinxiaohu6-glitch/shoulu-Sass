<script setup lang="ts">
import type { Week } from '~~/shared/types/catalog'
import { WEEKLY_EMPTY_COPY } from '~~/shared/content/weekly-empty'
import { isIsoWeekId } from '~~/shared/utils/weekly-board'

const { lang, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const { categories: liveCategories } = useDirectoryMeta()
const overrides = useOverrides()
const submitted = await useSubmittedTools()
const boardData = await useBoardData()

// The board slot is sold as "one row inside the leaderboard, after third
// place". Nothing booked means no row at all. It is marked Sponsored and
// does not take a vote rank.
const { board: boardAd } = await useAds()

type Move = { kind: 'new' | 'up' | 'down' | 'flat'; delta: number }
type Panel = {
  key: string
  label: string
  current: boolean
  rows: { rank: number; slug: string; votes: number; move: Move }[]
}

const directory = computed(() =>
  mergeDirectory(orderedTools(lang.value, overrides.value), submitted.value, overrides.value),
)

function toolOf(slug: string) {
  return directory.value.find((tool) => tool.slug === slug)
}

function logoSrc(slug: string): string {
  const logo = toolOf(slug)?.logo ?? ''
  if (!logo) return `/assets/img/icons/${slug}.png`
  if (/^https?:\/\//i.test(logo)) return logo
  return logo.startsWith('/') ? logo : `/${logo}`
}

function shortWeek(id: string): string {
  return id.replace(/^\d{4}-/, '')
}

function rowsOf(week: Week, previous: Week | undefined) {
  const prev = new Map<string, number>()
  previous?.ranking.forEach((row, index) => {
    prev.set(row.slug, row.rank ?? index + 1)
  })
  return week.ranking
    .filter((row) => row.votes > 0)
    .map((row, index) => {
      const rank = row.rank ?? index + 1
      const before = prev.get(row.slug)
      const move: Move = before === undefined
        ? { kind: 'new', delta: 0 }
        : before === rank
          ? { kind: 'flat', delta: 0 }
          : before > rank
            ? { kind: 'up', delta: before - rank }
            : { kind: 'down', delta: rank - before }
      return { rank, slug: row.slug, votes: row.votes, move }
    })
}

const panels = computed<Panel[]>(() => {
  const payload = boardData.value
  const current = payload.current
  const history = payload.history ?? []
  const list: Panel[] = []

  if (current?.id) {
    list.push({
      key: current.id,
      label: `${lang.value === 'zh' ? current.label_zh : current.label_en} · ${pick('本周', 'current')}`,
      current: true,
      rows: rowsOf(current, history[0]),
    })
  }

  history.forEach((week, index) => {
    list.push({
      key: week.id,
      label: lang.value === 'zh' ? week.label_zh : week.label_en,
      current: false,
      rows: rowsOf(week, history[index + 1]),
    })
  })

  const selected = payload.week
  if (selected?.id && !list.some((item) => item.key === selected.id)) {
    list.push({
      key: selected.id,
      label: lang.value === 'zh' ? selected.label_zh : selected.label_en,
      current: false,
      rows: rowsOf(selected, undefined),
    })
  }

  return list
})

const activeId = computed(() => {
  const requested = String(route.query.week ?? '').trim()
  if (isIsoWeekId(requested) && panels.value.some((item) => item.key === requested)) return requested
  return boardData.value.current?.id || panels.value[0]?.key || ''
})

const panel = computed(() => panels.value.find((item) => item.key === activeId.value) ?? panels.value[0] ?? {
  key: '',
  label: '',
  current: true,
  rows: [] as Panel['rows'],
})

const periodLabel = computed(() => {
  const week = boardData.value.current
  if (!week) return ''
  return lang.value === 'zh'
    ? `${week.label_zh}（${week.id}）`
    : `${week.label_en} (${shortWeek(week.id)})`
})

async function selectWeek(id: string) {
  const currentId = boardData.value.current?.id
  await router.replace({
    path: route.path,
    query: id && id !== currentId ? { week: id } : {},
  })
}

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
        {{ pick('当前周期: ', 'Current period: ') }}{{ periodLabel }}
      </p>
    </header>

    <nav class="tab-nav tab-nav--weeks" :aria-label="pick('周榜', 'Weekly')">
      <button
        v-for="item in panels"
        :key="item.key"
        class="pill"
        :class="{ 'is-active': item.key === activeId }"
        type="button"
        :aria-selected="item.key === activeId"
        @click="selectWeek(item.key)"
      >
        {{ item.label }}
      </button>
    </nav>

    <div class="week-panel is-active">
      <!-- Empty only when this week has no product with at least one vote. -->
      <div v-if="!panel.rows.length" class="board-empty">
        <p class="board-empty__title">{{ pick(WEEKLY_EMPTY_COPY.title.zh, WEEKLY_EMPTY_COPY.title.en) }}</p>
        <p class="board-empty__body">{{ pick(WEEKLY_EMPTY_COPY.body.zh, WEEKLY_EMPTY_COPY.body.en) }}</p>
        <NuxtLink class="board-empty__cta" :to="localePath('/submit')">
          {{ pick(WEEKLY_EMPTY_COPY.cta.zh, WEEKLY_EMPTY_COPY.cta.en) }}
        </NuxtLink>
      </div>
      <table v-if="panel.rows.length" class="rank-table">
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
                <NuxtLink class="rank-tool" :to="localePath(`/products/${row.slug}`)">
                  <span class="tool-icon" style="width: 32px; height: 32px">
                    <img
                      :src="logoSrc(row.slug)"
                      alt=""
                      width="32"
                      height="32"
                      loading="lazy"
                    >
                  </span>
                  <span>
                    <strong>{{ toolOf(row.slug)?.name ?? row.slug }}</strong>
                    <em>{{ toolOf(row.slug)?.short }}</em>
                  </span>
                </NuxtLink>
              </td>
              <td class="rank-cat">
                <span v-if="categoryBySlug(toolOf(row.slug)?.category ?? '', liveCategories)" class="chip">
                  {{ localizeCategory(categoryBySlug(toolOf(row.slug)!.category, liveCategories)!, lang).name }}
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

            <!-- Sponsored row: after third place, not a vote rank. -->
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
/* Same stroke as the homepage open ad slot: dark gray in both themes. */
.board-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 196px;
  padding: 36px 24px 32px;
  text-align: center;
  border: 2px dashed oklch(40% 0.025 70);
  border-radius: 18px;
  background: var(--card);
}

.board-empty__title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--foreground);
}

.board-empty__body {
  margin: 6px 0 0;
  max-width: 28rem;
  font-size: 13px;
  line-height: 1.45;
  color: var(--muted-foreground);
}

.board-empty__cta {
  margin-top: 14px;
  font-size: 14px;
  font-weight: 650;
  color: var(--foreground);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.board-empty__cta:hover {
  color: var(--primary);
}

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
