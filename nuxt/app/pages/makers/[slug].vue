<script setup lang="ts">
const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const route = useRoute()

const slug = computed(() => String(route.params.slug || ''))

// A maker page exists for anyone with a live listing, curated or submitted, so
// the lookup has to see both.
const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { categories: liveCategories } = useDirectoryMeta()
const maker = computed(() =>
  makerBySlug(slug.value, lang.value, submitted.value, overrides.value),
)

if (!maker.value) {
  throw createError({
    statusCode: 404,
    statusMessage: isZh.value ? '没有这个开发者' : 'No such maker',
    fatal: true,
  })
}

const cats = computed(() =>
  maker.value ? makerCategories(maker.value, lang.value, liveCategories.value) : [],
)
const catSlugs = computed(() => new Set(cats.value.map((c) => c.slug)))

/** Makers sharing at least one category, in index order, four at most. */
const siblings = computed(() =>
  allMakers(lang.value, submitted.value, overrides.value)
    .filter((m) => m.slug !== slug.value)
    .filter((m) => m.tools.some((tool) => catSlugs.value.has(tool.category)))
    .slice(0, 4)
    .map((m) => ({
      ...m,
      hue: makerHue(m.name),
      initial: makerInitial(m.name),
      cats: makerCategories(m, lang.value, liveCategories.value).slice(0, 1),
    })),
)

const names = computed(() => (maker.value ? maker.value.tools.map((t) => t.name).join(isZh.value ? '、' : ', ') : ''))

const intro = computed(() => {
  if (!maker.value) return ''
  const n = maker.value.tools.length
  return isZh.value
    ? `${maker.value.name} 在 Product Atlas 有 ${n} 款产品：${names.value}。下面按本周票数排序。`
    : `${maker.value.name} has ${n} product${n === 1 ? '' : 's'} on Product Atlas: ${names.value}. Ordered by votes this week.`
})

useSeo({
  title: computed(() =>
    isZh.value
      ? `${maker.value!.name} 的 AI 产品 · Product Atlas`
      : `${maker.value!.name} — AI products · Product Atlas`,
  ),
  description: computed(() =>
    isZh.value
      ? `${maker.value!.name} 在 Product Atlas 上收录的 ${maker.value!.tools.length} 个 AI 产品。`
      : `${maker.value!.tools.length} AI products by ${maker.value!.name} on Product Atlas.`,
  ),
})
</script>

<template>
  <div class="container">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" />
      <NuxtLink :to="localePath('/makers')">{{ pick('开发者', 'Makers') }}</NuxtLink>
      <Icon name="chevron-right" />
      <span>{{ maker!.name }}</span>
    </nav>

    <header class="maker-head">
      <span
        class="maker-av"
        :style="{ width: '64px', height: '64px', '--h': makerHue(maker!.name) }"
        aria-hidden="true"
      >{{ makerInitial(maker!.name) }}</span>
      <div class="maker-head__body">
        <h1 class="page-title">{{ maker!.name }}</h1>
        <p class="maker-head__cats">
          <NuxtLink v-for="cat in cats" :key="cat.slug" class="chip" :to="localePath(`/categories/${cat.slug}`)">
            {{ cat.name }}
          </NuxtLink>
        </p>
      </div>
    </header>

    <p class="maker-intro">{{ intro }}</p>

    <section>
      <div class="section-head">
        <div class="section-head__title">
          <h2>{{ isZh ? `${maker!.name} 的产品` : `Products by ${maker!.name}` }}</h2>
          <p>
            {{ isZh
              ? `${maker!.tools.length} 款，按本周票数排序。`
              : `${maker!.tools.length} listed, ordered by votes this week.` }}
          </p>
        </div>
      </div>

      <ol class="board">
        <li v-for="(tool, i) in maker!.tools" :key="tool.slug" class="board__row">
          <NuxtLink class="board__link" :to="localePath(`/tools/${tool.slug}`)">
            <span class="board__rank">{{ i + 1 }}</span>
            <span class="tool-icon" style="width: 38px; height: 38px">
              <ToolLogo :logo="tool.logo" :name="tool.name" :size="38" lazy decorative />
            </span>
            <span class="board__body">
              <span class="board__name">{{ tool.name }}</span>
              <span class="board__desc">{{ tool.short }}</span>
            </span>
            <span class="board__meta">
              <span class="board__tag">
                <Icon name="shapes" />
                {{
                  categoryBySlug(tool.category, liveCategories)
                    ? localizeCategory(categoryBySlug(tool.category, liveCategories)!, lang).name
                    : ''
                }}
              </span>
              <span class="board__votes">
                <Icon name="arrow-up" />{{ tool.votes_week }}
              </span>
            </span>
          </NuxtLink>
        </li>
      </ol>
    </section>

    <section v-if="siblings.length" style="margin-top: 40px">
      <div class="section-head">
        <div class="section-head__title">
          <h2>{{ pick('同分类的开发者', 'Makers in the same categories') }}</h2>
          <p>{{ pick('做相近方向的团队。', 'Teams working on adjacent problems.') }}</p>
        </div>
      </div>

      <div class="maker-grid">
        <NuxtLink v-for="m in siblings" :key="m.slug" class="maker-card" :to="localePath(`/makers/${m.slug}`)">
          <span class="maker-av" :style="{ width: '40px', height: '40px', '--h': m.hue }" aria-hidden="true">{{ m.initial }}</span>
          <span class="maker-card__body">
            <span class="maker-card__name">{{ m.name }}</span>
            <span class="maker-card__meta">
              {{ isZh ? `${m.tools.length} 款产品` : `${m.tools.length} product${m.tools.length === 1 ? '' : 's'}` }}
            </span>
          </span>
          <span class="maker-card__cats">
            <span v-for="cat in m.cats" :key="cat.slug" class="chip">{{ cat.name }}</span>
          </span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
