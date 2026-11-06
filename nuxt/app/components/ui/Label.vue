<script setup lang="ts">
/** Source `components/ui/label.tsx`. */
import { cn } from '~/utils/ui'

defineOptions({ inheritAttrs: false })

const props = defineProps<{ class?: string; for?: string }>()
</script>

<template>
  <label
    v-bind="$attrs"
    :for="props.for"
    data-slot="label"
    :class="
      cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-text group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </label>
</template>
