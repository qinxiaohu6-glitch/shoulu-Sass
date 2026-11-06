<script setup lang="ts">
/** Source `components/ui/card.tsx` — `Card`, class string unchanged. */
import { cn } from '~/utils/ui'

const props = withDefaults(defineProps<{ size?: 'default' | 'sm'; class?: string }>(), {
  size: 'default',
})
</script>

<template>
  <div
    data-slot="card"
    :data-size="props.size"
    :class="
      cn(
        'group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
