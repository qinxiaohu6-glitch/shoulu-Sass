<script setup lang="ts">
/** Source `routes/settings/-dashboard-widgets.tsx` — `RecentRow`. */
const props = defineProps<{ title: string; date: string; value: string; muted?: boolean }>()
</script>

<template>
  <li class="flex items-center justify-between gap-4 py-2.5">
    <div class="min-w-0">
      <p class="truncate text-sm">{{ props.title }}</p>
      <p class="text-xs text-muted-foreground">{{ props.date }}</p>
    </div>
    <span
      class="shrink-0 text-sm font-medium tabular-nums"
      :class="props.muted && 'text-muted-foreground'"
    >
      {{ props.value }}
    </span>
  </li>
</template>
