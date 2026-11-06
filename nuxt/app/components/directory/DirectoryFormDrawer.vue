<script setup lang="ts">
/**
 * Source `routes/admin/directory/-form-ui.tsx` — `DirectoryFormDrawer`.
 *
 * Wider than the default Sheet so forms stay readable; sticky header, scroll
 * body. The two `data-[side=*]` overrides undo Sheet's `sm:max-w-sm` (384px)
 * on desktop and keep the drawer full width on mobile — the source comments on
 * exactly this, and it is why the class list is repeated rather than replaced.
 */
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{ open: boolean; title: string; description?: string; class?: string }>(),
  { description: '' },
)

const emit = defineEmits<{ 'update:open': [boolean] }>()
</script>

<template>
  <UiSheet :open="props.open" @update:open="(v: boolean) => emit('update:open', v)">
    <UiSheetContent
      side="right"
      :class="
        cn(
          'flex w-full flex-col gap-0 p-0',
          'data-[side=left]:w-full data-[side=right]:w-full',
          'data-[side=left]:sm:max-w-2xl data-[side=right]:sm:max-w-2xl',
          props.class,
        )
      "
    >
      <UiSheetHeader class="shrink-0 space-y-1 border-b px-6 py-4 pr-12 text-left">
        <UiSheetTitle>{{ props.title }}</UiSheetTitle>
        <UiSheetDescription v-if="props.description">{{ props.description }}</UiSheetDescription>
        <UiSheetDescription v-else class="sr-only">{{ props.title }}</UiSheetDescription>
      </UiSheetHeader>
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <slot />
      </div>
    </UiSheetContent>
  </UiSheet>
</template>
