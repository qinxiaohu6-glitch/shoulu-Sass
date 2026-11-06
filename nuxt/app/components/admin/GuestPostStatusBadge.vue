<script setup lang="ts">
/**
 * Source `routes/settings/guest-posts/-shared.tsx` — `GuestPostStatusBadge`.
 *
 * Pass `note` to show the reviewer's note on hover, but only in the states it
 * explains: an earlier note shouldn't linger after a resubmit.
 */
import { MessageSquareText } from 'lucide-vue-next'
import { guestPostStatusVariant, noteExplains } from '~/utils/guest-posts-ui'

const props = withDefaults(defineProps<{ status: string; note?: string | null }>(), {
  note: null,
})

const { t } = useSettingsI18n()

const withNote = computed(() => noteExplains(props.status, props.note))
</script>

<template>
  <UiBadge v-if="!withNote" :variant="guestPostStatusVariant(props.status)">
    {{ t(`guest_posts.status_${props.status}`) }}
  </UiBadge>

  <span v-else class="inline-flex items-center gap-1.5">
    <UiBadge :variant="guestPostStatusVariant(props.status)">
      {{ t(`guest_posts.status_${props.status}`) }}
    </UiBadge>
    <UiTooltip>
      <UiTooltipTrigger>
        <button
          type="button"
          :aria-label="t('guest_posts.review_note')"
          class="text-muted-foreground hover:text-foreground inline-flex"
        >
          <MessageSquareText class="size-4" />
        </button>
      </UiTooltipTrigger>
      <UiTooltipContent class="block max-w-xs whitespace-pre-line">
        <span class="mb-0.5 block font-medium">{{ t('guest_posts.review_note') }}</span>
        {{ props.note }}
      </UiTooltipContent>
    </UiTooltip>
  </span>
</template>
