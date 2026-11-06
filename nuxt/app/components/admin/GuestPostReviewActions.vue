<script setup lang="ts">
/**
 * Source `routes/admin/-guest-posts-review-actions.tsx` — the note box and the
 * buttons whose availability depends on the submission's status.
 *
 * `keepsEdits` and `askConfirm` are passed in rather than owned here: both are
 * the panel's promise-based confirm dialog, and the editor's unsaved state is
 * the panel's to know.
 */
import { Eye } from 'lucide-vue-next'
import { formatPrice } from '~/utils/guest-posts-ui'
import { buttonVariants, cn } from '~/utils/ui'

type Pkg = {
  planName: string
  maxLinks: number
  priceInCents: number
  currency: string
} | null

const props = defineProps<{
  status: string
  busy: boolean
  dirty: boolean
  restorable: boolean
  pkg: Pkg
  postSlug: string
  keepsEdits: () => Promise<boolean>
  askConfirm: (opts: {
    title: string
    description: string
    confirmLabel?: string
    destructive?: boolean
  }) => Promise<boolean>
}>()

const emit = defineEmits<{
  approve: []
  requestChanges: []
  reject: []
  unpublish: []
  republish: []
  restoreRequestChanges: []
}>()

const note = defineModel<string>('note', { required: true })

const { t } = useSettingsI18n()

const showNote = computed(() =>
  ['submitted', 'changes_requested', 'published'].includes(props.status) || props.restorable,
)

async function onRequestChanges() {
  if (await props.keepsEdits()) emit('requestChanges')
}

async function onReject() {
  const price = props.pkg ? formatPrice(props.pkg.priceInCents, props.pkg.currency) : ''
  if (!(await props.keepsEdits())) return
  if (
    await props.askConfirm({
      title: t('admin.guest_posts.reject'),
      description: t('admin.guest_posts.reject_confirm', { price }),
      confirmLabel: t('admin.guest_posts.reject'),
      destructive: true,
    })
  )
    emit('reject')
}

async function onUnpublish() {
  if (!(await props.keepsEdits())) return
  if (
    await props.askConfirm({
      title: t('admin.guest_posts.unpublish'),
      description: t('admin.guest_posts.unpublish_confirm'),
      confirmLabel: t('admin.guest_posts.unpublish'),
      destructive: true,
    })
  )
    emit('unpublish')
}

async function onRepublish() {
  if (
    await props.askConfirm({
      title: t('admin.guest_posts.republish'),
      description: t('admin.guest_posts.republish_confirm'),
      confirmLabel: t('admin.guest_posts.republish'),
    })
  )
    emit('republish')
}
</script>

<template>
  <div class="space-y-3 border-t pt-4">
    <div v-if="showNote" class="space-y-2">
      <UiLabel for="gp-note">{{ t('admin.guest_posts.note') }}</UiLabel>
      <UiTextarea
        id="gp-note"
        v-model="note"
        :rows="2"
        :maxlength="2000"
        :placeholder="t('admin.guest_posts.note_placeholder')"
      />
    </div>

    <div class="flex flex-wrap gap-2">
      <template v-if="props.status === 'submitted'">
        <UiButton :disabled="props.busy" @click="emit('approve')">
          {{ t('admin.guest_posts.approve') }}
        </UiButton>
        <UiButton
          variant="outline"
          :disabled="props.busy || !note.trim()"
          @click="onRequestChanges"
        >
          {{ t('admin.guest_posts.request_changes') }}
        </UiButton>
      </template>

      <UiButton
        v-if="props.status === 'submitted' || props.status === 'changes_requested'"
        variant="outline"
        class="text-destructive"
        :disabled="props.busy || !note.trim()"
        @click="onReject"
      >
        {{ t('admin.guest_posts.reject') }}
      </UiButton>

      <UiButton
        v-if="props.status === 'published'"
        variant="outline"
        class="text-destructive"
        :disabled="props.busy"
        @click="onUnpublish"
      >
        {{ t('admin.guest_posts.unpublish') }}
      </UiButton>

      <template v-if="props.restorable">
        <UiButton :disabled="props.busy" @click="onRepublish">
          {{ t('admin.guest_posts.republish') }}
        </UiButton>
        <UiButton
          variant="outline"
          :disabled="props.busy || !note.trim()"
          @click="onRequestChanges"
        >
          {{ t('admin.guest_posts.request_changes') }}
        </UiButton>
      </template>

      <a
        v-if="props.status !== 'published'"
        :href="`/blog/${props.postSlug}?preview=1`"
        target="_blank"
        rel="noopener"
        :title="props.dirty ? t('admin.guest_posts.preview_unsaved') : undefined"
        :class="cn(buttonVariants({ variant: 'ghost' }), 'ml-auto gap-1.5')"
      >
        <Eye class="size-4" />
        {{ t('guest_posts.preview') }}
      </a>
    </div>

    <p v-if="props.status === 'submitted'" class="text-muted-foreground text-xs">
      {{ t('admin.guest_posts.review_hint') }}
    </p>
    <p v-if="props.status === 'unpublished'" class="text-muted-foreground text-xs">
      {{
        props.restorable
          ? t('admin.guest_posts.restore_hint')
          : t('admin.guest_posts.refunded_hint')
      }}
    </p>
  </div>
</template>
