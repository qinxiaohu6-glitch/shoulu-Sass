<script setup lang="ts">
/** Source `components/ui/tabs.tsx` — `TabsContent`. */
import { TabsContent } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = defineProps<{ value: string; class?: string }>()
</script>

<template>
  <TabsContent
    :value="props.value"
    data-slot="tabs-content"
    :class="cn('flex-1 text-sm outline-none', props.class)"
  >
    <slot />
  </TabsContent>
</template>
