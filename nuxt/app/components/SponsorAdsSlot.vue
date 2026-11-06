<script setup lang="ts">
/**
 * Ported from `src/components/directory/SponsorAdsSlot.tsx`.
 *
 * Markup and behaviour follow the source: a "Sponsors" label, the booked cards,
 * then an "Advertise here" card that is always there — the source renders it
 * even with zero bookings, and that card is the only thing a visitor sees until
 * the first ad sells.
 *
 * Two things the source has that this build does not:
 *
 *  - **Tiers.** The source serves `silver|gold|platinum` with per-tier card
 *    styling and a tier glyph. The `ads` table here has a single booking per
 *    slot and no tier column, so every card takes the source's own fallback —
 *    `SPONSOR_TIER_STYLES[ad.tier] || SPONSOR_TIER_STYLES.silver`, which is a
 *    line the source already has for unknown tiers.
 *  - **Placement filtering.** `listing` (gold+platinum) vs `detail` (all tiers)
 *    is a tier question, so it has nothing to filter on here. The prop is kept
 *    so callers read the same as the source.
 */
import type { AdPublic } from '~/composables/useAds'

const props = withDefaults(
  defineProps<{
    limit?: number
    class?: string
    /** listing = home/list pages (gold+platinum); detail = tool pages (all tiers). */
    placement?: 'listing' | 'detail'
  }>(),
  { limit: 4, class: '', placement: 'detail' },
)

const { pick } = useLang()
const localePath = useLocalePath()
const { sidebar } = await useAds()

/** The source's `SPONSOR_TIER_STYLES.silver`, the fallback branch. */
const SILVER = {
  icon: 'award',
  iconClass: 'text-slate-400',
  card: 'border-border bg-card hover:border-primary/35',
}

const ads = computed<AdPublic[]>(() => {
  const ad = sidebar.value
  return ad ? [ad].slice(0, props.limit) : []
})
</script>

<template>
  <div :class="props.class || 'space-y-2'">
    <p class="mb-2 text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
      {{ pick('赞助商', 'Sponsors') }}
    </p>

    <a
      v-for="ad in ads"
      :key="ad.id"
      :href="ad.url"
      target="_blank"
      rel="noopener noreferrer sponsored"
      class="group relative flex items-start gap-3 rounded-xl border p-3 transition"
      :class="SILVER.card"
    >
      <span
        class="absolute right-2.5 top-2.5 flex items-center gap-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase text-muted-foreground"
      >
        {{ pick('赞助', 'Sponsor') }}
        <Icon :name="SILVER.icon" :size="12" :class="SILVER.iconClass" />
      </span>
      <span
        class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
      >
        <img
          v-if="ad.logo"
          :src="ad.logo"
          :alt="ad.name"
          width="32"
          height="32"
          loading="lazy"
          class="size-8 object-cover"
        >
        <Icon v-else name="sparkles" :size="16" class="text-muted-foreground" />
      </span>
      <span class="min-w-0 flex-1 pr-14">
        <span class="flex items-center gap-1 text-sm font-semibold leading-tight">
          <span class="truncate">{{ ad.name }}</span>
          <Icon
            name="arrow-up-right"
            :size="14"
            class="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100"
          />
        </span>
        <span
          v-if="ad.headline"
          class="mt-1 line-clamp-2 block text-xs leading-4 text-muted-foreground"
        >
          {{ ad.headline }}
        </span>
      </span>
    </a>

    <NuxtLink
      :to="localePath('/advertise')"
      class="block rounded-xl border border-dashed border-border p-4 text-[13px] text-muted-foreground transition hover:border-primary/35 hover:text-foreground"
    >
      <span class="flex items-center gap-1.5 font-medium text-foreground">
        <Icon name="megaphone" :size="14" />
        {{ pick('在这里投放', 'Advertise here') }}
      </span>
      <span class="mt-1 block text-xs">
        {{ pick('让正在挑选工具的用户看到你的产品。', 'Put your product in front of people choosing their next tool.') }}
      </span>
    </NuxtLink>
  </div>
</template>
