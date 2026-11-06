<script setup lang="ts">
/**
 * Source `routes/admin/-guest-posts-review-editor.tsx` — the article, always
 * editable in the review panel.
 */
import type { ReviewDraft } from '~/utils/guest-posts-ui'

const props = defineProps<{
  slugChanged: boolean
  dirty: boolean
  busy: boolean
}>()
const emit = defineEmits<{ save: []; discard: [] }>()

const draft = defineModel<ReviewDraft>('draft', { required: true })

const { t } = useSettingsI18n()

function patch(part: Partial<ReviewDraft>) {
  draft.value = { ...draft.value, ...part }
}
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-2">
      <UiLabel>{{ t('guest_posts.field_title') }}</UiLabel>
      <UiInput
        :model-value="draft.title"
        :maxlength="200"
        @update:model-value="(v: any) => patch({ title: String(v ?? '') })"
      />
    </div>

    <div class="space-y-2">
      <UiLabel for="gp-admin-slug">{{ t('guest_posts.field_slug') }}</UiLabel>
      <AdminGuestPostSlugInput
        id="gp-admin-slug"
        prefix="/blog/"
        :value="draft.slug"
        :placeholder="t('guest_posts.slug_placeholder')"
        @change="(slug: string) => patch({ slug })"
      />
      <p v-if="props.slugChanged" class="text-destructive text-xs">
        {{ t('admin.guest_posts.slug_change_warning') }}
      </p>
      <p v-else class="text-muted-foreground text-xs">
        {{ t('admin.guest_posts.slug_hint') }}
      </p>
    </div>

    <div class="space-y-2">
      <UiLabel>{{ t('guest_posts.field_summary') }}</UiLabel>
      <UiTextarea
        :model-value="draft.description"
        :rows="2"
        :maxlength="500"
        @update:model-value="(v: any) => patch({ description: String(v ?? '') })"
      />
    </div>

    <div class="space-y-2">
      <UiLabel>{{ t('guest_posts.field_content') }}</UiLabel>
      <RichTextEditor
        :value="draft.content"
        @change="(content: string) => patch({ content })"
      />
    </div>

    <div v-if="props.dirty" class="flex items-center gap-2">
      <UiButton :disabled="props.busy" @click="emit('save')">
        {{ t('admin.guest_posts.save') }}
      </UiButton>
      <UiButton variant="outline" :disabled="props.busy" @click="emit('discard')">
        {{ t('admin.guest_posts.discard') }}
      </UiButton>
      <span class="text-muted-foreground text-xs">
        {{ t('admin.guest_posts.unsaved') }}
      </span>
    </div>
  </div>
</template>
