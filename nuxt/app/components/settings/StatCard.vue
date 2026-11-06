<script setup lang="ts">
/**
 * Source `routes/settings/-dashboard-widgets.tsx` — `StatCard`.
 *
 * The whole card is a link: the value is a link with `after:absolute
 * after:inset-0` stretching over the card, and the optional action button sits
 * above it on `z-10` so it stays separately clickable. That is why the action
 * wrapper carries `relative z-10` and not just spacing.
 */
import type { Component } from 'vue'

const props = defineProps<{
  href: string
  title: string
  icon: Component
  hint: string
}>()

const localePath = useLocalePath()
</script>

<template>
  <UiCard class="relative transition-colors hover:bg-muted/40">
    <UiCardHeader class="flex flex-row items-center justify-between pb-2">
      <UiCardTitle class="text-sm font-medium text-muted-foreground">
        {{ props.title }}
      </UiCardTitle>
      <component :is="props.icon" class="size-4 text-muted-foreground" />
    </UiCardHeader>
    <UiCardContent class="space-y-1">
      <NuxtLink :to="localePath(props.href)" class="block after:absolute after:inset-0">
        <div class="truncate text-2xl font-semibold tabular-nums">
          <slot name="value" />
        </div>
      </NuxtLink>
      <div class="flex items-center justify-between gap-2">
        <p class="truncate text-xs text-muted-foreground">{{ props.hint }}</p>
        <div v-if="$slots.action" class="relative z-10 shrink-0">
          <slot name="action" />
        </div>
      </div>
    </UiCardContent>
  </UiCard>
</template>
