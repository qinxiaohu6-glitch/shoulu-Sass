<script setup lang="ts">
/** Source `components/ui/checkbox.tsx`. */
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { Check } from 'lucide-vue-next'
import { cn } from '~/utils/ui'

const props = defineProps<{ modelValue?: boolean | 'indeterminate'; class?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean | 'indeterminate'] }>()
</script>

<template>
  <CheckboxRoot
    :model-value="modelValue"
    :disabled="disabled"
    data-slot="checkbox"
    :class="
      cn(
        'peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary',
        props.class,
      )
    "
    @update:model-value="(v: any) => emit('update:modelValue', v)"
  >
    <CheckboxIndicator
      data-slot="checkbox-indicator"
      class="grid place-content-center text-current transition-none [&>svg]:size-3.5"
    >
      <Check />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
