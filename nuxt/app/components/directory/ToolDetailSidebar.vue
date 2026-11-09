<script setup lang="ts">
/**
 * Ported from `shipany-dir/src/components/directory/ToolDetailSidebar.tsx`.
 *
 * Two things: the detail-placement sponsor slot, then "Popular tools" — the top
 * five by rank, the first three numbered in the primary colour.
 *
 * `topPicks` is the source's `tool.popular` when the service has one, else the
 * homepage's top picks minus the tool being viewed. This build has the latter
 * (`boardRows()` of the current week), so the page passes that in.
 */
import type { LocalizedTool } from '~~/shared/types/catalog'

const props = defineProps<{ topPicks: LocalizedTool[] }>()

const localePath = useLocalePath()
const t = useDirectoryCopy()

const picks = computed(() => props.topPicks.slice(0, 5))
</script>

<template>
  <aside class="space-y-3 self-start lg:sticky lg:pt-2">
    <SponsorAdsSlot placement="detail" :limit="4" />

    <section v-if="picks.length" class="pt-6">
      <p class="mb-2 text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
        {{ t('directory.detail.popular_tools') }}
      </p>
      <ol class="space-y-2">
        <li v-for="(tool, index) in picks" :key="tool.slug">
          <NuxtLink
            :to="localePath(`/products/${tool.slug}`)"
            class="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition hover:border-primary/35"
          >
            <span
              class="w-4 shrink-0 text-center text-sm font-semibold tabular-nums"
              :class="index < 3 ? 'text-primary' : 'text-muted-foreground'"
            >
              {{ index + 1 }}
            </span>
            <div
              class="size-8 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-secondary/50"
            >
              <ToolLogo :logo="tool.logo" :name="tool.name" :size="32" lazy decorative />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">{{ tool.name }}</p>
              <p v-if="tool.short" class="truncate text-xs text-muted-foreground">
                {{ tool.short }}
              </p>
            </div>
          </NuxtLink>
        </li>
      </ol>
    </section>
  </aside>
</template>
