<script setup lang="ts">
/**
 * Source `routes/admin/directory/-categories-form.tsx` — `renderCategoryFields`.
 *
 * One field set used by both the create and the edit drawer, which is why it is
 * a component rather than two copies of the same eight inputs. The two flags
 * are the source's: `lockSlug` on edit (the slug is the public URL) and
 * `disableDraft` when the category still has listings (a draft would take them
 * off the site).
 *
 * The form object is mutated in place; it is a `ref` of a plain object, so the
 * mutations are reactive and the parent keeps one source of truth.
 */
import type { DirectoryFormValues } from '~/utils/admin-directory-ui'

const props = withDefaults(
  defineProps<{ form: DirectoryFormValues; lockSlug?: boolean; disableDraft?: boolean }>(),
  { lockSlug: false, disableDraft: false },
)

const { t } = useSettingsI18n()

const statusLabel = computed(() => t(`admin.directory.status_${props.form.status}`))
</script>

<template>
  <div class="space-y-4">
    <DirectoryTextField
      v-model="props.form.slug"
      :label="t('admin.directory.common.slug')"
      placeholder="coding"
      :disabled="props.lockSlug"
    />
    <p v-if="props.lockSlug" class="text-muted-foreground text-xs">
      {{ t('admin.directory.common.slug_locked_hint') }}
    </p>

    <DirectoryLocaleSection v-slot="{ locale }">
      <DirectoryTextField
        :model-value="locale === 'en' ? props.form.name : props.form.nameZh"
        :label="t('admin.directory.common.name')"
        :placeholder="locale === 'en' ? 'Coding' : '编程'"
        @update:model-value="(v: string) => (locale === 'en' ? (props.form.name = v) : (props.form.nameZh = v))"
      />
      <DirectoryTextField
        :model-value="locale === 'en' ? props.form.description : props.form.descriptionZh"
        :label="t('admin.directory.common.description')"
        @update:model-value="
          (v: string) => (locale === 'en' ? (props.form.description = v) : (props.form.descriptionZh = v))
        "
      />
    </DirectoryLocaleSection>

    <DirectoryFormRow>
      <DirectoryTextField
        v-model="props.form.icon"
        :label="t('admin.directory.categories.icon')"
        placeholder="code"
      />
      <div class="space-y-1">
        <DirectoryTextField
          v-model="props.form.sort"
          :label="t('admin.directory.categories.sort')"
          type="number"
        />
        <p class="text-muted-foreground text-xs">{{ t('admin.directory.common.sort_hint') }}</p>
      </div>
    </DirectoryFormRow>

    <div class="space-y-2">
      <UiLabel>{{ t('admin.directory.common.status') }}</UiLabel>
      <UiSelect
        :model-value="props.form.status"
        @update:model-value="(v: string) => (props.form.status = String(v || 'published'))"
      >
        <UiSelectTrigger class="w-full">
          <UiSelectValue :text="statusLabel" />
        </UiSelectTrigger>
        <UiSelectContent>
          <UiSelectItem value="published">{{ t('admin.directory.status_published') }}</UiSelectItem>
          <UiSelectItem value="draft" :disabled="props.disableDraft">
            {{ t('admin.directory.status_draft') }}
          </UiSelectItem>
        </UiSelectContent>
      </UiSelect>
      <p v-if="props.disableDraft" class="text-muted-foreground text-xs">
        {{ t('admin.directory.categories.draft_blocked_hint') }}
      </p>
    </div>
  </div>
</template>
