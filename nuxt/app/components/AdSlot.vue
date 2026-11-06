<script setup lang="ts">
/**
 * Ad slot.
 *
 * The live site's sidebar slot is `<!--ads:sidebar-->` — a build-time comment
 * that expands to nothing while no campaign is booked, so the homepage has no
 * visible placeholder there. Rendering an empty "ad slot" frame would add a box
 * the original does not have, so this renders nothing until an ad is booked.
 *
 * The link carries `sponsored nofollow`: it was paid for, and a paid link that
 * passes PageRank is exactly what Google's link-scheme policy penalises.
 */
import type { AdPublic } from '~/composables/useAds'

withDefaults(
  defineProps<{
    slot: 'board' | 'sidebar'
    ad?: AdPublic | null
  }>(),
  { ad: null },
)
</script>

<template>
  <a
    v-if="ad"
    :data-ad-slot="slot"
    class="rail-ad"
    :href="ad.url"
    rel="sponsored nofollow noopener"
    target="_blank"
  >
    <span class="rail-ad__top">
      <span class="rail-ad__tag">Sponsored</span>
    </span>
    <span class="rail-ad__main">
      <span class="rail-ad__body">
        <strong>{{ ad.name }}</strong>
        <em>{{ ad.headline }}</em>
      </span>
    </span>
    <span class="rail-ad__cta">Learn more →</span>
  </a>
</template>
