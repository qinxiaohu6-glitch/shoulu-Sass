<script setup lang="ts">
/**
 * Source `routes/admin/directory/-form-ui.tsx` — `DirectoryFormBody`.
 *
 * Scrollable field area plus a sticky cancel/save footer. The `actions` slot is
 * the source's `actions` prop: a node, not a config, because the create form
 * and the edit form disable different buttons.
 */
</script>

<template>
  <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
    <slot />
  </div>
  <div class="bg-background shrink-0 border-t px-6 py-4">
    <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <slot name="actions" />
    </div>
  </div>
</template>
