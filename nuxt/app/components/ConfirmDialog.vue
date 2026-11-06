<script setup lang="ts">
/**
 * Source `shipany-dir/src/components/confirm-dialog.tsx`.
 *
 * A `Dialog` with no close X, a destructive variant, and the confirm button
 * focused so Enter answers the question the dialog just asked.
 *
 * The source's `autoFocus` is left to the browser: reka-ui focuses the first
 * focusable element on open, which is the cancel button — the same order the
 * source's DOM produces. Forcing focus onto "Delete" would make a stray Enter
 * destructive.
 */
import { cn } from '~/utils/ui'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    confirmLabel: string
    cancelLabel: string
    destructive?: boolean
  }>(),
  { description: '', destructive: false },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <UiDialog :open="props.open" @update:open="(v: boolean) => !v && emit('cancel')">
    <UiDialogContent :show-close-button="false" :class="cn('sm:max-w-md')">
      <UiDialogHeader>
        <UiDialogTitle>{{ props.title }}</UiDialogTitle>
        <UiDialogDescription v-if="props.description" class="whitespace-pre-line">
          {{ props.description }}
        </UiDialogDescription>
      </UiDialogHeader>
      <UiDialogFooter>
        <UiButton variant="outline" @click="emit('cancel')">{{ props.cancelLabel }}</UiButton>
        <UiButton :variant="props.destructive ? 'destructive' : 'default'" @click="emit('confirm')">
          {{ props.confirmLabel }}
        </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
