<script setup lang="ts">
/** Source `components/ui/tooltip.tsx` — `TooltipTrigger`. */
import { TooltipTrigger } from 'reka-ui'
</script>

<template>
  <TooltipTrigger as-child data-slot="tooltip-trigger">
    <slot />
  </TooltipTrigger>
</template>
