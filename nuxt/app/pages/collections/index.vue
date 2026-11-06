<script setup lang="ts">
/**
 * /collections — curated shortlists.
 *
 * The list itself comes from the database (`useDirectoryMeta`), because a
 * collection is an editorial act: nothing in `catalog.json` implies one, so
 * there is no build-time fallback and an empty table means an empty page.
 *
 * The member previews are a different matter. They resolve against the same
 * tool list the rest of the site shows — `orderedTools` plus published
 * submissions — so a collection card can never advertise a logo that the
 * listing page would not show.
 */
import type { LocalizedTool } from '~~/shared/types/catalog'

const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()
const overrides = useOverrides()

const { collections } = useDirectoryMeta()
const submitted = await useSubmittedTools()

/** Every tool the site can render right now, keyed by slug. */
const toolIndex = computed(() => {
  const merged = mergeDirectory(
    orderedTools(lang.value, overrides.value),
    submitted.value,
    overrides.value,
  )
  return new Map(merged.map((tool) => [tool.slug, tool]))
})

const cards = computed(() =>
  collections.value.map((collection) => {
    // Membership is stored as an ordered list of slugs, but a slug can point at
    // a listing that was pulled or never existed — the card counts what is
    // actually renderable rather than what the row claims.
    const members = collection.tools
      .map((slug) => toolIndex.value.get(slug))
      .filter((tool): tool is LocalizedTool => Boolean(tool))
    return {
      ...localizeCollection(collection, lang.value),
      count: members.length,
      mix: members.slice(0, 4),
    }
  }),
)

const title = computed(() => pick('AI 工具精选合集', 'Curated AI tool collections'))
const lead = computed(() =>
  pick(
    '按场景整理的 AI 工具清单，每一款都附上入选理由。',
    'Hand-picked lists of the best AI tools for a job, with notes on why each one made the cut.',
  ),
)

useSeo({
  title: computed(() => `${title.value} · Product Atlas`),
  description: lead,
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: title.value,
          description: lead.value,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: cards.value.length,
            itemListElement: cards.value.map((collection, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              url: `https://dirtool.com/collections/${collection.slug}`,
              name: collection.name,
            })),
          },
        }),
      ),
    },
  ],
})
</script>

<template>
  <div class="container">
    <nav class="breadcrumb" :aria-label="pick('面包屑', 'breadcrumb')">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" />
      <span>{{ pick('合集', 'Collections') }}</span>
    </nav>

    <header class="page-head">
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-sub">{{ lead }}</p>
    </header>

    <div v-if="cards.length" class="coll-grid">
      <NuxtLink
        v-for="collection in cards"
        :key="collection.slug"
        class="coll-card"
        :to="localePath(`/collections/${collection.slug}`)"
      >
        <div class="coll-card__top">
          <span class="coll-card__icon">
            <Icon :name="collectionIcon(collection.icon, collection.slug)" />
          </span>
          <span class="coll-card__count">
            {{ collection.count }} {{ pick('个工具', 'tools') }}
          </span>
        </div>

        <div class="coll-card__body">
          <h2 class="coll-card__title">{{ collection.name }}</h2>
          <p v-if="collection.desc" class="coll-card__desc">{{ collection.desc }}</p>
        </div>

        <div class="coll-card__foot">
          <span class="coll-card__stack">
            <ToolLogo
              v-for="tool in collection.mix"
              :key="tool.slug"
              :logo="tool.logo"
              :name="tool.name"
              :size="24"
              decorative
              lazy
            />
          </span>
          <span class="coll-card__more">
            {{ pick('浏览合集', 'Explore') }}
            <Icon name="arrow-right" />
          </span>
        </div>
      </NuxtLink>
    </div>

    <p v-else class="coll-empty">
      {{ pick('暂无合集，稍后再来看看。', 'No collections yet. Check back soon.') }}
    </p>
  </div>
</template>
