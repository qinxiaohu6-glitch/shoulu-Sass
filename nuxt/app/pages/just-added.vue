<script setup lang="ts">
const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()

// The page copy already promises "including community submissions that passed
// review", so the list has to honour it — newest of either origin first.
const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { categories: liveCategories, tags: liveTags } = useDirectoryMeta()

const list = computed(() =>
  [...submitted.value, ...latestTools(lang.value, 100, overrides.value)]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 100),
)

const title = computed(() => pick('最新收录', 'Just added'))
const lead = computed(() =>
  pick(
    '按收录时间排序，包含社区提交并通过审核的产品。',
    'Sorted by listing date — including community submissions that passed review.',
  ),
)

/* Mirrors `rel_day()` in the old generator: under a week reads as "6 days ago",
   a week or more falls back to a full date. The zh date is hand-assembled
   because `toLocaleDateString('zh-CN')` omits the spaces around 年/月/日 that
   the live pages carry ("2026 年 10 月 26 日"). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function listedWhen(createdAt: string) {
  const then = new Date(`${createdAt}T00:00:00Z`)
  const days = Math.max(0, Math.floor((Date.now() - then.getTime()) / 86_400_000))
  if (days < 7) {
    if (days === 0) return isZh.value ? '今天' : 'today'
    if (days === 1) return isZh.value ? '昨天' : 'yesterday'
    return isZh.value ? `${days} 天前` : `${days} days ago`
  }
  const y = then.getUTCFullYear()
  const m = then.getUTCMonth() + 1
  const d = then.getUTCDate()
  return isZh.value ? `${y} 年 ${m} 月 ${d} 日` : `${MONTHS[m - 1]} ${d}, ${y}`
}

const popularTags = computed(() => liveTags.value.slice(0, 15))

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
      <span>{{ pick('最新收录', 'Just added') }}</span>
    </nav>

    <header class="page-head">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-sub">{{ lead }}</p>
    </header>

    <div class="feed-layout">
      <div style="min-width: 0">
        <ol class="feed-list feed-list--plain">
          <li v-for="tool in list" :key="tool.slug">
            <NuxtLink class="feed-row" :to="localePath(`/products/${tool.slug}`)">
              <span class="tool-icon" style="width: 40px; height: 40px">
                <ToolLogo :logo="tool.logo" :name="tool.name" :size="40" lazy decorative />
              </span>
              <span class="feed-row__body">
                <span class="feed-row__title">
                  <strong>{{ tool.name }}</strong>
                  <span v-if="isPinned(tool, undefined, overrides)" class="star"><Icon name="sparkles" /></span>
                </span>
                <span class="feed-row__desc">{{ tool.short }}</span>
              </span>
              <span class="feed-row__meta">
                <time :datetime="tool.created_at">{{ listedWhen(tool.created_at) }}</time>
                <span v-if="categoryBySlug(tool.category, liveCategories)" class="chip">
                  {{ localizeCategory(categoryBySlug(tool.category, liveCategories)!, lang).name }}
                </span>
              </span>
            </NuxtLink>
          </li>
        </ol>
      </div>

      <aside class="rail">
        <RailHeat />
        <TopPicks :limit="5" />

        <section>
          <div class="section-head section-head--stack">
            <div class="section-head__title">
              <h2>{{ pick('热门标签', 'Popular tags') }}</h2>
            </div>
          </div>
          <div class="tag-cloud">
            <NuxtLink v-for="tag in popularTags" :key="tag.slug" class="tag-pill" :to="localePath(`/tags/${tag.slug}`)">
              #{{ localizeTag(tag, lang).name }}
            </NuxtLink>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
