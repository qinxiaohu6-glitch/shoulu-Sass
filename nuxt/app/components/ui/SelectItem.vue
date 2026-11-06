<script setup lang="ts">
/** Source `components/ui/select.tsx` — `SelectItem`. */
import { SelectItem, SelectItemIndicator, SelectItemText } from 'reka-ui'
import { Check } from 'lucide-vue-next'
import { cn } from '~/utils/ui'

const props = defineProps<{ value: string; class?: string; disabled?: boolean }>()
</script>

<template>
  <SelectItem
    :value="props.value"
    :disabled="props.disabled"
    data-slot="select-item"
    :class="
      cn(
        'relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2',
        props.class,
      )
    "
  >
    <SelectItemText class="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
      <slot />
    </SelectItemText>
    <SelectItemIndicator
      class="pointer-events-none absolute right-2 flex size-4 items-center justify-center"
    >
      <Check class="pointer-events-none" />
    </SelectItemIndicator>
  </SelectItem>
</template>
