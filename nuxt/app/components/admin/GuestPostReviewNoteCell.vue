<script setup lang="ts">
/**
 * Source `routes/settings/guest-posts/-shared.tsx` — `ReviewNoteCell`.
 *
 * The reviewer's note as a table cell (two lines; full text on hover).
 */
import { noteExplains } from '~/utils/guest-posts-ui'

const props = defineProps<{ status: string; note: string | null }>()
</script>

<template>
  <span v-if="!noteExplains(props.status, props.note)" class="text-muted-foreground">—</span>
  <span
    v-else
    :title="props.note || ''"
    class="text-muted-foreground line-clamp-2 max-w-[320px] text-sm whitespace-pre-line"
  >
    {{ props.note }}
  </span>
</template>
