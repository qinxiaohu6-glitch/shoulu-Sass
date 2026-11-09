<script setup lang="ts">
import type { LocalizedTool } from '~~/shared/types/catalog'

const props = defineProps<{ tool: LocalizedTool }>()

const { lang, pick } = useLang()
const localePath = useLocalePath()
const overrides = useOverrides()
/* Live category names: a rename in the console has to reach the badge on every
   card, and the card is rendered on nearly every page. */
const { categories: liveCategories } = useDirectoryMeta()

const cat = computed(() => {
  const hit = categoryBySlug(props.tool.category, liveCategories.value)
  return hit ? localizeCategory(hit, lang.value) : undefined
})

const pinned = computed(
  () => isPinned(props.tool, undefined, overrides.value) || props.tool.is_featured,
)
</script>

<template>
  <!--
    Structure is the live site's `.tool-card`: the whole card is clickable via
    `.tool-card__name a::after { position: absolute; inset: 0 }`, so the outer
    element is a plain div rather than a link.
  -->
  <div class="tool-card">
    <div class="tool-card__top">
      <div class="tool-icon" style="width: 44px; height: 44px">
        <ToolLogo :logo="tool.logo" :name="tool.name" :size="44" lazy />
      </div>
      <div class="tool-card__body">
        <div class="tool-card__name">
          <h3><NuxtLink :to="localePath(`/products/${tool.slug}`)">{{ tool.name }}</NuxtLink></h3>
          <span v-if="pinned" class="star" :title="pick('精选', 'Featured')">
            <Icon name="sparkles" />
            <span class="sr-only">{{ pick('精选', 'Featured') }}</span>
          </span>
        </div>
        <p class="tool-card__desc">{{ tool.short }}</p>
      </div>
    </div>
    <div class="tool-card__foot">
      <span v-if="tool.is_paid" class="chip chip--paid">{{ pick('赞助', 'Sponsored') }}</span>
      <span v-if="cat" class="chip">{{ cat.name }}</span>
      <VoteButton :slug="tool.slug" :votes="tool.votes_week" small />
    </div>
  </div>
</template>
