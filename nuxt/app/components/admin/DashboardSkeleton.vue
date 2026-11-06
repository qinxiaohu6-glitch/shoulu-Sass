<script setup lang="ts">
/**
 * Source `shipany-dir/src/components/admin/admin-skeletons.tsx` —
 * `DashboardSkeleton`.
 *
 * Same five regions and the same prop names. The skeleton exists so a
 * refreshing dashboard keeps its column widths instead of collapsing to a
 * zero-height box; the shapes below are the source's.
 */
import { cn } from '~/utils/ui'

withDefaults(
  defineProps<{
    cards: number
    cardsClassName: string
    charts: number
    chartHeightClassName?: string
    secondaryCards?: number
    secondaryCardsClassName?: string
    listRows?: number
  }>(),
  {
    chartHeightClassName: 'h-[240px]',
    secondaryCardsClassName: 'grid gap-4 sm:grid-cols-3',
  },
)
</script>

<template>
  <div class="space-y-6" aria-busy="true" aria-live="polite">
    <div :class="cardsClassName">
      <UiCard v-for="i in cards" :key="i">
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <UiSkeleton class="h-3.5 w-16" />
          <UiSkeleton class="size-4 rounded" />
        </UiCardHeader>
        <UiCardContent class="space-y-2">
          <UiSkeleton class="h-7 w-20" />
          <UiSkeleton class="h-3 w-28" />
        </UiCardContent>
      </UiCard>
    </div>

    <div v-if="secondaryCards && secondaryCards > 0" :class="secondaryCardsClassName">
      <UiCard v-for="i in secondaryCards" :key="`s-${i}`">
        <UiCardHeader class="flex flex-row items-center justify-between pb-2">
          <UiSkeleton class="h-3.5 w-16" />
          <UiSkeleton class="size-4 rounded" />
        </UiCardHeader>
        <UiCardContent class="space-y-2">
          <UiSkeleton class="h-7 w-20" />
          <UiSkeleton class="h-3 w-28" />
        </UiCardContent>
      </UiCard>
    </div>

    <div v-if="charts > 0" class="grid gap-6 lg:grid-cols-2">
      <UiCard v-for="i in charts" :key="i" class="min-w-0 overflow-hidden">
        <UiCardHeader class="space-y-2">
          <UiSkeleton class="h-4 w-32" />
          <UiSkeleton class="h-3 w-48" />
        </UiCardHeader>
        <UiCardContent class="min-w-0">
          <UiSkeleton :class="cn('w-full rounded-md', chartHeightClassName)" />
        </UiCardContent>
      </UiCard>
    </div>

    <UiCard v-if="listRows && listRows > 0">
      <UiCardHeader class="space-y-2">
        <UiSkeleton class="h-4 w-36" />
        <UiSkeleton class="h-3 w-56" />
      </UiCardHeader>
      <UiCardContent class="space-y-3">
        <div v-for="i in listRows" :key="i" class="flex items-center gap-4">
          <UiSkeleton class="size-6 rounded-full" />
          <div class="flex-1 space-y-1.5">
            <UiSkeleton class="h-4 w-48 max-w-full" />
            <UiSkeleton class="h-3 w-24" />
          </div>
          <UiSkeleton class="h-4 w-12" />
          <UiSkeleton class="h-4 w-12" />
          <UiSkeleton class="h-4 w-12" />
        </div>
      </UiCardContent>
    </UiCard>
  </div>
</template>
