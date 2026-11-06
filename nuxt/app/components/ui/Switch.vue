<script setup lang="ts">
/**
 * Source `components/ui/switch.tsx`.
 *
 * Base UI marks state with `data-checked` / `data-unchecked`; reka-ui uses
 * `data-[state=checked|unchecked]`. The thumb's translate is driven by the same
 * group-data selectors, translated the same way.
 */
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{ modelValue?: boolean; size?: 'sm' | 'default'; class?: string; disabled?: boolean }>(),
  { size: 'default' },
)
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <SwitchRoot
    :model-value="modelValue"
    :disabled="disabled"
    data-slot="switch"
    :data-size="props.size"
    :class="
      cn(
        'peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        props.class,
      )
    "
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <SwitchThumb
      data-slot="switch-thumb"
      class="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-[state=checked]:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-[state=checked]:translate-x-[calc(100%-2px)] dark:data-[state=checked]:bg-primary-foreground group-data-[size=default]/switch:data-[state=unchecked]:translate-x-0 group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-0 dark:data-[state=unchecked]:bg-foreground"
    />
  </SwitchRoot>
</template>
