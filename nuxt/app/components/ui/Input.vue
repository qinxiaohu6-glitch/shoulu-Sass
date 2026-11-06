<script setup lang="ts">
/**
 * Source `components/ui/input.tsx`.
 *
 * The source wraps `@base-ui/react/input` for no reason visible in its class
 * list — every styling hook is a plain attribute — so this is a native input.
 * `inheritAttrs: false` keeps `v-model`, `type`, `required`, `maxlength` and the
 * rest of the caller's attributes landing on the element rather than the root
 * wrapper, which is what the Base UI primitive did.
 */
import { cn } from '~/utils/ui'

defineOptions({ inheritAttrs: false })

const props = defineProps<{ class?: string }>()
const model = defineModel<string | number | undefined>()
</script>

<template>
  <input
    v-bind="$attrs"
    v-model="model"
    data-slot="input"
    :class="
      cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        props.class,
      )
    "
  >
</template>
