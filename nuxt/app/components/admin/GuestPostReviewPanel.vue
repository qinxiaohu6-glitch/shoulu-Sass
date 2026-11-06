<script setup lang="ts">
/**
 * Source `routes/admin/-guest-posts-review.tsx` — one view: the article is
 * always editable, and the review actions save pending edits first (approve) or
 * ask before dropping them (the rest).
 *
 * `useConfirm()` in the source renders a dialog from a hook. Vue cannot render
 * a component out of a composable, so the same promise-based confirm lives here
 * as a ref plus `<ConfirmDialog>` — `askConfirm()` returns the promise the
 * source's callers await.
 *
 * Every endpoint behind this panel refuses: this build has no submission store
 * and sells no guest-post packages (see `server/api/admin/guest-posts/`). The
 * panel is the source's, and its toasts carry the server's explanation.
 */
import { ExternalLink } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import {
  countExternalLinks,
  countWords,
  formatPrice,
  type GuestPostRow,
  type ReviewDraft,
} from '~/utils/guest-posts-ui'

interface AdminDetail {
  submission: GuestPostRow & { status: string; userId: string }
  post: {
    slug: string
    title: string | null
    description: string | null
    image: string | null
    content: string | null
  }
  userName: string | null
  userEmail: string | null
  userAvatar: string | null
  orderStatus: string | null
  package: {
    planName: string
    maxLinks: number
    priceInCents: number
    currency: string
  } | null
}

const props = defineProps<{ id: string }>()
const emit = defineEmits<{ changed: []; done: [] }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

const detail = ref<AdminDetail | null>(null)
const detailError = ref<string | null>(null)
const loading = ref(true)

const note = ref('')
const draft = ref<ReviewDraft | null>(null)
const busy = ref(false)

const confirmState = ref({
  open: false,
  title: '',
  description: '',
  confirmLabel: t('common.confirm.ok'),
  cancelLabel: t('common.confirm.cancel'),
  destructive: false,
})
let confirmResolve: ((ok: boolean) => void) | null = null

function askConfirm(opts: {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}) {
  // A second question while one is open answers the first with "no", which is
  // what the source's `resolveRef.current?.(false)` does.
  confirmResolve?.(false)
  confirmState.value = {
    open: true,
    title: opts.title,
    description: opts.description ?? '',
    confirmLabel: opts.confirmLabel ?? t('common.confirm.ok'),
    cancelLabel: opts.cancelLabel ?? t('common.confirm.cancel'),
    destructive: !!opts.destructive,
  }
  return new Promise<boolean>((resolve) => {
    confirmResolve = resolve
  })
}

function settleConfirm(ok: boolean) {
  confirmResolve?.(ok)
  confirmResolve = null
  confirmState.value.open = false
}

function toDraft(post: AdminDetail['post']): ReviewDraft {
  return {
    title: post.title || '',
    slug: post.slug || '',
    description: post.description || '',
    image: post.image || '',
    content: post.content || '',
  }
}

const saved = computed(() => (detail.value ? toDraft(detail.value.post) : null))

const dirty = computed(() => {
  if (!draft.value || !saved.value) return false
  const keys = Object.keys(saved.value) as (keyof ReviewDraft)[]
  return keys.some((k) => draft.value![k] !== saved.value![k])
})

async function load() {
  loading.value = true
  detailError.value = null
  try {
    const data = await api.get<AdminDetail>(`/api/admin/guest-posts/${props.id}`)
    detail.value = data
    draft.value = toDraft(data.post)
  } catch (error) {
    detailError.value = (error as Error).message
  } finally {
    loading.value = false
  }
}

watch(() => props.id, load, { immediate: true })

const links = computed(() => countExternalLinks(draft.value?.content || ''))

/** Taken down but still paid for: it can come back. */
const restorable = computed(
  () => detail.value?.submission.status === 'unpublished' && detail.value?.orderStatus === 'paid',
)

const slugChanged = computed(
  () =>
    detail.value?.submission.status === 'published' &&
    (draft.value?.slug || '').trim().toLowerCase() !== detail.value?.post.slug,
)

/** Actions that don't publish leave edits unsaved; confirm dropping them. */
async function keepsEdits() {
  if (!dirty.value) return true
  return askConfirm({
    title: t('admin.guest_posts.unsaved_title'),
    description: t('admin.guest_posts.unsaved_discard'),
    confirmLabel: t('admin.guest_posts.discard_continue'),
    destructive: true,
  })
}

async function saveDraft() {
  await api.put(`/api/admin/guest-posts/${props.id}`, draft.value)
}

async function onApprove() {
  busy.value = true
  try {
    // Publish what the reviewer sees, edits included.
    if (dirty.value) await saveDraft()
    await api.post(`/api/admin/guest-posts/${props.id}`, { action: 'approve', note: note.value })
    toast.success(t('admin.guest_posts.reviewed_toast'))
    emit('changed')
    emit('done')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    busy.value = false
  }
}

async function onRequestChanges() {
  busy.value = true
  try {
    await api.post(`/api/admin/guest-posts/${props.id}`, {
      action: 'request_changes',
      note: note.value,
    })
    toast.success(t('admin.guest_posts.reviewed_toast'))
    emit('changed')
    emit('done')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    busy.value = false
  }
}

async function onReject() {
  busy.value = true
  try {
    await api.post(`/api/admin/guest-posts/${props.id}/reject`, { note: note.value })
    toast.success(t('admin.guest_posts.rejected_toast'))
    emit('changed')
    emit('done')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    busy.value = false
  }
}

async function onUnpublish() {
  busy.value = true
  try {
    await api.patch(`/api/admin/guest-posts/${props.id}`, { note: note.value })
    toast.success(t('admin.guest_posts.unpublished_toast'))
    emit('changed')
    emit('done')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    busy.value = false
  }
}

async function onRepublish() {
  busy.value = true
  try {
    if (dirty.value) await saveDraft()
    await api.post(`/api/admin/guest-posts/${props.id}/restore`, {
      action: 'republish',
      note: note.value,
    })
    toast.success(t('admin.guest_posts.reviewed_toast'))
    emit('changed')
    emit('done')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    busy.value = false
  }
}

async function onRestoreRequestChanges() {
  busy.value = true
  try {
    await api.post(`/api/admin/guest-posts/${props.id}/restore`, {
      action: 'request_changes',
      note: note.value,
    })
    toast.success(t('admin.guest_posts.reviewed_toast'))
    emit('changed')
    emit('done')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    busy.value = false
  }
}

async function onSaveEdit() {
  if (
    slugChanged.value &&
    !(await askConfirm({
      title: t('admin.guest_posts.slug_change_title'),
      description: t('admin.guest_posts.slug_change_confirm'),
      destructive: true,
    }))
  )
    return
  busy.value = true
  try {
    await saveDraft()
    toast.success(t('admin.guest_posts.saved_toast'))
    emit('changed')
    // Re-seed from the saved row (the server normalizes the slug).
    await load()
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    busy.value = false
  }
}

function onDiscard() {
  draft.value = saved.value ? { ...saved.value } : null
}
</script>

<template>
  <div class="space-y-5">
    <ConfirmDialog
      :open="confirmState.open"
      :title="confirmState.title"
      :description="confirmState.description"
      :confirm-label="confirmState.confirmLabel"
      :cancel-label="confirmState.cancelLabel"
      :destructive="confirmState.destructive"
      @confirm="settleConfirm(true)"
      @cancel="settleConfirm(false)"
    />

    <p v-if="detailError" class="text-muted-foreground">{{ detailError }}</p>
    <p v-else-if="loading || !draft || !detail" class="text-muted-foreground">
      {{ t('admin.loading') }}
    </p>

    <template v-else>
      <UiDialogHeader>
        <UiDialogTitle class="flex flex-wrap items-center gap-3 pr-6">
          {{ detail.post.title || '—' }}
          <AdminGuestPostStatusBadge :status="detail.submission.status" />
        </UiDialogTitle>
      </UiDialogHeader>

      <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt class="text-muted-foreground text-xs">{{ t('admin.guest_posts.author_col') }}</dt>
          <dd class="mt-0.5">
            <AdminUserCell
              :user-id="detail.submission.userId"
              :name="detail.userName"
              :email="detail.userEmail"
              :image="detail.userAvatar"
            />
          </dd>
        </div>
        <div>
          <dt class="text-muted-foreground text-xs">{{ t('admin.guest_posts.package') }}</dt>
          <dd class="mt-0.5">
            {{
              detail.package
                ? `${detail.package.planName} · ${formatPrice(detail.package.priceInCents, detail.package.currency)}`
                : detail.submission.productId
            }}
          </dd>
        </div>
        <div>
          <dt class="text-muted-foreground text-xs">{{ t('admin.guest_posts.counts') }}</dt>
          <dd class="mt-0.5">
            <span
              :class="
                detail.package && links > detail.package.maxLinks ? 'text-destructive' : undefined
              "
            >
              {{
                t('guest_posts.link_count', {
                  count: links,
                  max: detail.package?.maxLinks ?? 0,
                })
              }}
            </span>
            <span class="text-muted-foreground block text-xs">
              {{ t('admin.guest_posts.words', { count: countWords(draft.content) }) }}
            </span>
          </dd>
        </div>
        <div>
          <dt class="text-muted-foreground text-xs">{{ t('admin.guest_posts.submitted_at') }}</dt>
          <dd class="mt-0.5">{{ formatDateTime(detail.submission.submittedAt) }}</dd>
        </div>
        <div v-if="detail.submission.orderNo">
          <dt class="text-muted-foreground text-xs">{{ t('admin.guest_posts.order') }}</dt>
          <dd class="mt-0.5"><span class="font-mono text-xs">{{ detail.submission.orderNo }}</span></dd>
        </div>
      </dl>

      <a
        v-if="detail.submission.status === 'published'"
        :href="`/blog/${detail.post.slug}`"
        target="_blank"
        rel="noopener"
        class="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
      >
        {{ t('guest_posts.view_article') }}
        <ExternalLink class="size-3.5" />
      </a>

      <div v-if="detail.submission.reviewNote" class="bg-muted rounded-lg p-3 text-sm">
        <p class="font-medium">{{ t('guest_posts.review_note') }}</p>
        <p class="text-muted-foreground mt-1 whitespace-pre-line">
          {{ detail.submission.reviewNote }}
        </p>
      </div>

      <AdminGuestPostReviewEditor
        v-model:draft="draft"
        :slug-changed="slugChanged"
        :dirty="dirty"
        :busy="busy"
        @save="onSaveEdit"
        @discard="onDiscard"
      />

      <AdminGuestPostReviewActions
        v-model:note="note"
        :status="detail.submission.status"
        :busy="busy"
        :dirty="dirty"
        :restorable="restorable"
        :pkg="detail.package"
        :post-slug="detail.post.slug"
        :keeps-edits="keepsEdits"
        :ask-confirm="askConfirm"
        @approve="onApprove"
        @request-changes="onRequestChanges"
        @reject="onReject"
        @unpublish="onUnpublish"
        @republish="onRepublish"
        @restore-request-changes="onRestoreRequestChanges"
      />
    </template>
  </div>
</template>
