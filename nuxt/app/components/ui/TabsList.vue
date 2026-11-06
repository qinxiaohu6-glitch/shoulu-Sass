<script setup lang="ts">
/**
 * Source `components/ui/tabs.tsx` — `TabsList`.
 *
 * Base UI marks orientation with a bare `data-horizontal` / `data-vertical`
 * attribute; reka-ui uses `data-orientation="horizontal"`. The `group-data-*`
 * variants are translated to match, otherwise every size rule in the list would
 * silently stop applying.
 */
import { TabsList } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = withDefaults(defineProps<{ class?: string; variant?: 'default' | 'line' }>(), {
  variant: 'default',
})
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    :data-variant="props.variant"
    :class="
      cn(
        'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-8 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none',
        props.variant === 'line' ? 'gap-1 bg-transparent' : 'bg-muted',
        props.class,
      )
    "
  >
    <slot />
  </TabsList>
</template>
