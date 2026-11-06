<script setup lang="ts">
/**
 * Ported from `shipany-dir/src/components/directory/DirectoryCommon.tsx` —
 * `DirectoryPagination`.
 *
 * Renders one button per page, the way the source does: the directory is small
 * enough that a windowed pager (1 … 4 5 6 … 12) would be more machinery than the
 * pages it replaces. `null` when there is only one page, which is why callers can
 * render it unconditionally.
 */
const props = defineProps<{ currentPage: number; totalPages: number }>()
const emit = defineEmits<{ change: [page: number] }>()

const t = useDirectoryCopy()

const pages = computed(() =>
  Array.from({ length: Math.max(0, props.totalPages) }, (_, index) => index + 1),
)
</script>

<template>
  <nav v-if="totalPages > 1" class="mt-10 flex items-center justify-center gap-1.5">
    <button
      type="button"
      :disabled="currentPage <= 1"
      class="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-xs font-medium transition hover:border-primary/40 hover:bg-secondary/50 disabled:pointer-events-none disabled:opacity-40"
      @click="emit('change', currentPage - 1)"
    >
      <Icon name="chevron-left" :size="14" />
      <span>{{ t('directory.previous') }}</span>
    </button>

    <button
      v-for="page in pages"
      :key="page"
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition"
      :class="
        page === currentPage
          ? 'bg-primary font-semibold text-primary-foreground shadow-sm'
          : 'border border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary/50'
      "
      @click="emit('change', page)"
    >
      {{ page }}
    </button>

    <button
      type="button"
      :disabled="currentPage >= totalPages"
      class="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 text-xs font-medium transition hover:border-primary/40 hover:bg-secondary/50 disabled:pointer-events-none disabled:opacity-40"
      @click="emit('change', currentPage + 1)"
    >
      <span>{{ t('directory.next') }}</span>
      <Icon name="chevron-right" :size="14" />
    </button>
  </nav>
</template>
