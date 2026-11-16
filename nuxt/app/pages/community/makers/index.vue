<script setup lang="ts">
/**
 * /community/makers — the maker directory. A profile exists only when that
 * maker has a live product. This is not a social feed.
 */
const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()

const submitted = await useSubmittedTools()
const overrides = useOverrides()
const { categories: liveCategories } = useDirectoryMeta()

const list = computed(() =>
  allMakers(lang.value, submitted.value, overrides.value).map((maker) => ({
    ...maker,
    hue: makerHue(maker.name),
    initial: makerInitial(maker.name),
    cats: makerCategories(maker, lang.value, liveCategories.value).slice(0, 1),
  })),
)

const counts = computed(() =>
  liveDirectoryCounts(
    [...tools.map((tool) => localizeTool(tool, lang.value)), ...submitted.value].map((tool) => ({
      slug: tool.slug,
      makerSlug: tool.makerSlug,
    })),
    overrides.value.hidden,
  ),
)

const description = computed(() =>
  isZh.value
    ? makersDirectoryMetaZh(counts.value.makers, counts.value.products)
    : makersDirectoryMeta(counts.value.makers, counts.value.products),
)

useSeo({
  title: computed(() => pick('创客 · Product Atlas', 'Makers · Product Atlas')),
  description,
})
</script>

<template>
  <div class="container">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" />
      <NuxtLink :to="localePath('/community')">{{ pick('社区', 'Community') }}</NuxtLink>
      <Icon name="chevron-right" />
      <span>{{ pick('创客', 'Makers') }}</span>
    </nav>

    <header class="page-head">
      <h1 class="page-title">{{ pick('创客', 'Makers') }}</h1>
      <p class="page-sub">
        {{
          pick(
            'Product Atlas 收录背后的个人和团队档案。',
            'Profiles of the people and teams behind listings on Product Atlas.',
          )
        }}
      </p>
      <p class="community-counts">{{ description }}</p>
    </header>

    <p v-if="list.length === 0" class="community-note">
      {{
        pick(
          '还没有创客档案。提交一款产品才会生成档案。',
          'No maker profiles yet. Submit a product to create one.',
        )
      }}
      <NuxtLink :to="localePath('/submit')">{{ pick('提交产品', 'Submit a product') }}</NuxtLink>
    </p>

    <div v-else class="maker-grid">
      <NuxtLink
        v-for="maker in list"
        :key="maker.slug"
        class="maker-card"
        :to="localePath(`/community/makers/${maker.slug}`)"
      >
        <span class="maker-av" :style="{ width: '40px', height: '40px', '--h': maker.hue }" aria-hidden="true">{{ maker.initial }}</span>
        <span class="maker-card__body">
          <span class="maker-card__name">{{ maker.name }}</span>
          <span class="maker-card__meta">
            {{
              isZh
                ? `${maker.tools.length} 款在架产品`
                : `${maker.tools.length} live ${maker.tools.length === 1 ? 'product' : 'products'}`
            }}
          </span>
        </span>
        <span class="maker-card__cats">
          <span v-for="cat in maker.cats" :key="cat.slug" class="chip">{{ cat.name }}</span>
        </span>
      </NuxtLink>
    </div>
  </div>
</template>
