<script setup lang="ts">
/**
 * Source `components/ui/select.tsx` — root.
 *
 * The source wraps Base UI's `Select.Root` to pre-collect every item's label,
 * because a closed Base UI trigger falls back to rendering the raw value
 * ("all") instead of its label. reka-ui has the same limitation for a different
 * reason: items only register their text while the popup is mounted. Rather than
 * rebuilding that tree-walk, `UiSelectValue` takes the label as a `text` prop —
 * the three call sites in settings all already have the label in hand.
 */
import { SelectRoot } from 'reka-ui'

defineProps<{ modelValue?: string; disabled?: boolean; name?: string; required?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    :disabled="disabled"
    :name="name"
    :required="required"
    @update:model-value="(v: any) => emit('update:modelValue', v as string)"
  >
    <slot />
  </SelectRoot>
</template>
