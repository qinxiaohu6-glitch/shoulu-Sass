<script setup lang="ts">
/**
 * Source `components/slug-input.tsx` — a URL slug field with a fixed path
 * prefix, tidied on blur with the same normalization the server applies.
 */
import { tidySlug } from '~/utils/guest-posts-ui'

const props = withDefaults(
  defineProps<{
    id?: string
    prefix: string
    value: string
    placeholder?: string
    maxLength?: number
  }>(),
  { id: undefined, placeholder: '', maxLength: 80 },
)
const emit = defineEmits<{ change: [string] }>()
</script>

<template>
  <div
    class="border-input focus-within:ring-ring/50 flex items-center overflow-hidden rounded-lg border focus-within:ring-3"
  >
    <span class="text-muted-foreground bg-muted border-input border-r px-2.5 py-1 text-sm">
      {{ props.prefix }}
    </span>
    <input
      :id="props.id"
      :value="props.value"
      :maxlength="props.maxLength"
      :placeholder="props.placeholder"
      class="placeholder:text-muted-foreground h-8 min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none"
      @input="emit('change', ($event.target as HTMLInputElement).value)"
      @blur="emit('change', tidySlug(props.value))"
    />
  </div>
</template>
