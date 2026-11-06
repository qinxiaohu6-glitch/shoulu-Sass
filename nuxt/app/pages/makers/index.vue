<script setup lang="ts">
const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()

// Community listings contribute makers too, so the index is the catalogue plus
// whatever the database has published.
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

// A hidden listing still exists, but it is not a product the site shows, so it
// must not be counted in the heading either.
const productCount = computed(
  () =>
    tools.filter((tool) => !isHiddenTool(tool, overrides.value)).length +
    submitted.value.filter((tool) => !isHiddenTool(tool, overrides.value)).length,
)

const title = computed(() => pick('开发者', 'Makers'))
const lead = computed(() =>
  isZh.value
    ? `${list.value.length} 个开发者，${productCount.value} 款产品。`
    : `${list.value.length} makers behind ${productCount.value} products.`,
)

useSeo({
  title: computed(() => `${title.value} · Product Atlas`),
  description: lead,
})
</script>

<template>
  <div class="container">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" />
      <span>{{ title }}</span>
    </nav>

    <header class="page-head">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-sub">{{ lead }}</p>
    </header>

    <div class="maker-grid">
      <NuxtLink v-for="maker in list" :key="maker.slug" class="maker-card" :to="localePath(`/makers/${maker.slug}`)">
        <span class="maker-av" :style="{ width: '40px', height: '40px', '--h': maker.hue }" aria-hidden="true">{{ maker.initial }}</span>
        <span class="maker-card__body">
          <span class="maker-card__name">{{ maker.name }}</span>
          <span class="maker-card__meta">
            {{ isZh ? `${maker.tools.length} 款产品` : `${maker.tools.length} product${maker.tools.length === 1 ? '' : 's'}` }}
          </span>
        </span>
        <span class="maker-card__cats">
          <span v-for="cat in maker.cats" :key="cat.slug" class="chip">{{ cat.name }}</span>
        </span>
      </NuxtLink>
    </div>
  </div>
</template>
