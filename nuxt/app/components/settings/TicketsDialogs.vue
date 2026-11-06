<script setup lang="ts">
/**
 * Source `routes/settings/-tickets-dialogs.tsx` — the create form and one thread.
 *
 * Both dialogs live in one component, as in the source: they share the same
 * uploader wiring and the same "close = clear" behaviour, and splitting them
 * would mean two places to keep the attachment limits in step.
 *
 * The 20 setter props the source threads through become four `v-model`s (the
 * fields the user types into) plus two events that carry an uploader's whole
 * state at once (`{ urls, uploading }`), because in Vue a callback that only
 * ever assigns two refs is an event.
 *
 * Attachment upload has no storage binding in this build — see
 * `server/api/storage/upload-image.post.ts`. The uploader is the source's, and
 * a picked file reports the source's own "storage is not configured" copy
 * instead of pretending to succeed.
 */
import { cn } from '~/utils/ui'
import { STATUS_BADGE, type TicketMessageRow, type TicketRow } from '~/utils/tickets-ui'

const props = defineProps<{
  activeTicket: TicketRow | null
  messages: TicketMessageRow[]
  uploaderKey: number
  replyUploaderKey: number
  uploading: boolean
  replyUploading: boolean
  submitting: boolean
  replying: boolean
}>()

const emit = defineEmits<{
  attachments: [payload: { urls: string[]; uploading: boolean }]
  'reply-attachments': [payload: { urls: string[]; uploading: boolean }]
  'submit-create': []
  'submit-reply': []
  'close-ticket': []
  'close-detail': []
}>()

const createOpen = defineModel<boolean>('createOpen', { required: true })
const title = defineModel<string>('title', { required: true })
const content = defineModel<string>('content', { required: true })
const reply = defineModel<string>('reply', { required: true })

const { t } = useSettingsI18n()

/** `uploaderState()` from `-tickets-shared.tsx`, applied to one change event. */
function onAttachments(items: { status: string; url?: string }[]) {
  emit('attachments', {
    urls: items.filter((i) => i.status === 'uploaded' && i.url).map((i) => i.url!),
    uploading: items.some((i) => i.status === 'uploading'),
  })
}

function onReplyAttachments(items: { status: string; url?: string }[]) {
  emit('reply-attachments', {
    urls: items.filter((i) => i.status === 'uploaded' && i.url).map((i) => i.url!),
    uploading: items.some((i) => i.status === 'uploading'),
  })
}

/** Unix seconds → the reader's locale string. */
function stamp(seconds: number) {
  return new Date(seconds * 1000).toLocaleString()
}
</script>

<template>
  <!-- Create dialog -->
  <UiDialog v-model:open="createOpen">
    <UiDialogContent>
      <UiDialogHeader>
        <UiDialogTitle>{{ t('settings.tickets.create_title') }}</UiDialogTitle>
        <UiDialogDescription>
          {{ t('settings.tickets.create_description') }}
        </UiDialogDescription>
      </UiDialogHeader>

      <form @submit.prevent="emit('submit-create')">
        <div class="space-y-4 py-2">
          <div class="space-y-1.5">
            <UiLabel for="ticket-title">{{ t('settings.tickets.title_label') }}</UiLabel>
            <UiInput
              id="ticket-title"
              v-model="title"
              :maxlength="200"
              :placeholder="t('settings.tickets.title_placeholder')"
            />
          </div>

          <div class="space-y-1.5">
            <UiLabel for="ticket-content">{{ t('settings.tickets.content_label') }}</UiLabel>
            <UiTextarea
              id="ticket-content"
              v-model="content"
              :maxlength="5000"
              :rows="6"
              :placeholder="t('settings.tickets.content_placeholder')"
            />
          </div>

          <div class="space-y-1.5">
            <UiLabel>{{ t('settings.tickets.attachments_label') }}</UiLabel>
            <ImageUploader
              :key="props.uploaderKey"
              allow-multiple
              :max-images="9"
              @change="onAttachments"
            />
          </div>
        </div>

        <UiDialogFooter>
          <UiButton type="button" variant="outline" @click="createOpen = false">
            {{ t('settings.tickets.cancel') }}
          </UiButton>
          <UiButton type="submit" :disabled="props.submitting || props.uploading">
            {{
              props.submitting
                ? t('settings.tickets.creating')
                : t('settings.tickets.create_submit')
            }}
          </UiButton>
        </UiDialogFooter>
      </form>
    </UiDialogContent>
  </UiDialog>

  <!-- Detail dialog -->
  <UiDialog
    :open="!!props.activeTicket"
    @update:open="(v: boolean) => !v && emit('close-detail')"
  >
    <UiDialogContent class="sm:max-w-2xl">
      <UiDialogHeader>
        <UiDialogTitle class="flex items-center gap-2">
          {{ props.activeTicket?.title }}
          <UiBadge
            v-if="props.activeTicket"
            :variant="STATUS_BADGE[props.activeTicket.status]"
          >
            {{ t(`settings.tickets.status_${props.activeTicket.status}`) }}
          </UiBadge>
        </UiDialogTitle>
      </UiDialogHeader>

      <div class="max-h-[50vh] space-y-3 overflow-y-auto py-2">
        <div
          v-for="msg in props.messages"
          :key="msg.id"
          :class="
            cn(
              'rounded-lg p-3 text-sm',
              msg.role === 'admin' ? 'mr-8 bg-primary/10' : 'ml-8 bg-muted',
            )
          "
        >
          <div class="mb-1 flex items-center justify-between">
            <span class="flex items-center gap-1.5 text-xs font-medium">
              <UiAvatar v-if="msg.role === 'user'" class="size-5">
                <UiAvatarImage
                  :fallback="(msg.author || 'U').charAt(0).toUpperCase()"
                  fallback-class="text-[10px]"
                />
              </UiAvatar>
              {{
                msg.role === 'admin'
                  ? t('settings.tickets.support_team')
                  : msg.author || t('settings.tickets.you')
              }}
            </span>
            <span class="text-xs text-muted-foreground">{{ stamp(msg.created_at) }}</span>
          </div>
          <p class="whitespace-pre-wrap">{{ msg.content }}</p>
          <SettingsAttachmentGrid :urls="msg.attachments" />
        </div>
      </div>

      <form
        v-if="props.activeTicket?.status !== 'closed'"
        class="space-y-3"
        @submit.prevent="emit('submit-reply')"
      >
        <UiTextarea
          v-model="reply"
          :maxlength="5000"
          :rows="3"
          :placeholder="t('settings.tickets.reply_placeholder')"
        />
        <ImageUploader
          :key="props.replyUploaderKey"
          allow-multiple
          :max-images="9"
          @change="onReplyAttachments"
        />
        <UiDialogFooter>
          <UiButton type="button" variant="outline" @click="emit('close-ticket')">
            {{ t('settings.tickets.close_ticket') }}
          </UiButton>
          <UiButton
            type="submit"
            :disabled="props.replying || props.replyUploading || !reply.trim()"
          >
            {{
              props.replying ? t('settings.tickets.replying') : t('settings.tickets.reply_submit')
            }}
          </UiButton>
        </UiDialogFooter>
      </form>

      <p v-else class="text-sm text-muted-foreground">
        {{ t('settings.tickets.closed_notice') }}
      </p>
    </UiDialogContent>
  </UiDialog>
</template>
