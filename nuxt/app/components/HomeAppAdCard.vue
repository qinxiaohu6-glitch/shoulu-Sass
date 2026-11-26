<script setup lang="ts">
/**
 * The APP placement, rendered in three homepage positions from one booking:
 * the hero's left rail, and the two rails flanking the directory feed.
 *
 * `variant="hero"` borrows the global `.feat-card` shell so the card reads as a
 * sibling of the FEATURED rows above it; `variant="rail"` is self-contained
 * because the rail card styles live in `index.vue`'s scoped block and scoped
 * CSS does not reach into a child component.
 *
 * Sold: a sponsored link. `rel="sponsored nofollow"` because it was paid for —
 * a paid link that passes PageRank is what Google's link-scheme policy
 * penalises. Unsold: an honest "open" card with the weekly price, since a
 * silently missing slot just looks like a broken layout.
 */
import type { AdPublic } from '~/composables/useAds'
import { adPriceCents } from '~~/shared/content/pricing'

withDefaults(
  defineProps<{
    ad?: AdPublic | null
    variant?: 'hero' | 'rail'
  }>(),
  { ad: null, variant: 'rail' },
)

const { pick } = useLang()
const localePath = useLocalePath()

const weeklyLabel = computed(() => {
  const cents = adPriceCents('app', 1)
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
})
const bookTo = computed(() => `${localePath('/book-ad')}?slot=app&weeks=1`)
</script>

<template>
  <!-- Hero rail: a sibling of the FEATURED rows. -->
  <a
    v-if="ad && variant === 'hero'"
    class="feat-card feat-card--app"
    :href="ad.url"
    target="_blank"
    rel="sponsored nofollow noopener"
  >
    <ToolLogo :logo="ad.logo" :name="ad.name" :size="36" decorative />
    <span>
      <strong>{{ ad.name }} <em>{{ pick('赞助', 'Sponsored') }}</em></strong>
      <small>{{ ad.headline }}</small>
    </span>
  </a>
  <NuxtLink
    v-else-if="variant === 'hero'"
    class="feat-card feat-card--open feat-card--app"
    :to="bookTo"
  >
    <span class="feat-card__mark" aria-hidden="true">📱</span>
    <span>
      <strong>{{ pick('APP 广告位', 'App ad slot') }}</strong>
      <small>{{ pick(`首页三处 · ${weeklyLabel}/周`, `Three homepage spots · ${weeklyLabel}/week`) }}</small>
    </span>
  </NuxtLink>

  <!-- Directory rails. -->
  <a
    v-else-if="ad"
    class="app-rail-ad app-rail-ad--live"
    :href="ad.url"
    target="_blank"
    rel="sponsored nofollow noopener"
  >
    <ToolLogo :logo="ad.logo" :name="ad.name" :size="32" decorative />
    <span class="app-rail-ad__body">
      <strong>{{ ad.name }}</strong>
      <em>{{ pick('赞助', 'Sponsored') }}</em>
      <small>{{ ad.headline }}</small>
    </span>
  </a>
  <NuxtLink v-else class="app-rail-ad" :to="bookTo">
    <span class="app-rail-ad__mark" aria-hidden="true">📱</span>
    <span class="app-rail-ad__body">
      <strong>{{ pick('APP 广告位', 'App ad slot') }}</strong>
      <em>{{ pick('首页三处 · 每周一个应用', 'Three homepage spots · one app a week') }}</em>
      <small>{{ pick('首屏左栏与榜单左右两栏，同时展示你的应用。', 'Your app in the hero rail and both directory rails at once.') }}</small>
      <span class="app-rail-ad__foot">
        <b>{{ weeklyLabel }}<small>/{{ pick('周', 'week') }}</small></b>
        <span>{{ pick('预订此位', 'Book this spot') }} →</span>
      </span>
    </span>
  </NuxtLink>
</template>

<style scoped>
/* Mirrors `.rail-ad__card` in index.vue — that block is scoped to the page and
   cannot style a child component, so the shell is repeated here. */
.app-rail-ad {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-width: 0;
  padding: 14px;
  margin-bottom: 12px;
  border: 1.5px dashed #d9dce2;
  border-radius: 14px;
  background: var(--card, #fff);
  color: inherit;
  text-decoration: none;
  transition: border-color .18s ease, transform .2s ease;
}
.app-rail-ad--live { border-style: solid; }
.app-rail-ad:hover {
  border-color: color-mix(in oklab, var(--primary, #b45309) 45%, #d9dce2);
  transform: translateY(-1px);
}
.app-rail-ad:focus-visible {
  outline: 3px solid var(--ring, var(--primary, #b45309));
  outline-offset: 3px;
}
.app-rail-ad__mark { flex: none; font-size: 22px; line-height: 1; }
.app-rail-ad__body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.app-rail-ad__body strong { font-size: 13px; font-weight: 800; }
.app-rail-ad__body em { font-style: normal; font-size: 11px; color: var(--muted-foreground, #6b7280); }
.app-rail-ad__body small {
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 11px;
  line-height: 1.45;
  color: var(--muted-foreground, #6b7280);
}
.app-rail-ad__foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 6px; }
/* The rail is 236px wide: without `nowrap` the price breaks between "$39" and
   "/week" so the CTA can stay on one line. Let the CTA wrap instead. */
.app-rail-ad__foot b { flex: none; white-space: nowrap; font-size: 14px; font-weight: 850; }
/* Something in the base layer gives `<small>` a block-ish display, which breaks
   "$39" and "/week" onto two lines inside the 236px rail. Keep it inline. */
.app-rail-ad__foot b small { display: inline; font-size: 11px; font-weight: 600; }
.app-rail-ad__foot > span { font-size: 11px; font-weight: 800; color: var(--primary, #b45309); }

/* The hero card only needs the one addition: the app mark sits where the
   FEATURED rows put a 36px logo, so the three cards stay on one grid. */
.feat-card--app { min-width: 0; }
.feat-card--app .feat-card__mark { font-size: 18px; }

/* `ToolLogo` renders a fixed-size <img> when the buyer supplied a logo, but a
   bare `.tool-logo__initial` span (`width: 100%`) when it did not — as a flex
   child that collapses to the letter's own width and drags the text block out
   of alignment. Give the fallback the same box the image would have. */
.feat-card--app :deep(.tool-logo__initial) {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #fff7ed;
}
.app-rail-ad :deep(.tool-logo__initial) {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: #fff7ed;
}
</style>
