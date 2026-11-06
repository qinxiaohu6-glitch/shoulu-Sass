<script setup lang="ts">
/** Source `components/ui/tabs.tsx` — root. */
import { TabsRoot } from 'reka-ui'

defineProps<{ modelValue?: string; orientation?: 'horizontal' | 'vertical' }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <TabsRoot
    :model-value="modelValue"
    :orientation="orientation ?? 'horizontal'"
    data-slot="tabs"
    :data-orientation="orientation ?? 'horizontal'"
    :class="'group/tabs flex gap-2 data-[orientation=horizontal]:flex-col'"
    @update:model-value="(v: any) => emit('update:modelValue', v as string)"
  >
    <slot />
  </TabsRoot>
</template>
