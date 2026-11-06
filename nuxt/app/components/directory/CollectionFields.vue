<script setup lang="ts">
/**
 * Source `routes/admin/directory/-collections-form.tsx` — `renderCollectionFields`.
 *
 * Slug, the bilingual name/description pair, icon + sort on one row, a cover
 * upload, and the published/draft select. `lockSlug` on edit only: the slug is
 * the public collection URL.
 */
import type { CollectionFormValues } from '~/utils/admin-collections-ui'

const props = withDefaults(defineProps<{ form: CollectionFormValues; lockSlug?: boolean }>(), {
  lockSlug: false,
})

const { t } = useSettingsI18n()

const statusLabel = computed(() => t(`admin.directory.status_${props.form.status}`))
</script>

<template>
  <div class="space-y-4">
    <DirectoryTextField
      v-model="props.form.slug"
      :label="t('admin.directory.common.slug')"
      placeholder="best-coding-agents"
      :disabled="props.lockSlug"
    />
    <p v-if="props.lockSlug" class="text-muted-foreground text-xs">
      {{ t('admin.directory.common.slug_locked_hint') }}
    </p>

    <DirectoryLocaleSection v-slot="{ locale }">
      <DirectoryTextField
        :model-value="locale === 'en' ? props.form.name : props.form.nameZh"
        :label="t('admin.directory.common.name')"
        :placeholder="locale === 'en' ? 'Best Coding Agents' : t('admin.directory.common.name_zh_placeholder')"
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
        :label="t('admin.directory.collections.icon')"
        placeholder="code"
      />
      <div class="space-y-1">
        <DirectoryTextField
          v-model="props.form.sort"
          :label="t('admin.directory.collections.sort')"
          type="number"
        />
        <p class="text-muted-foreground text-xs">{{ t('admin.directory.common.sort_hint') }}</p>
      </div>
    </DirectoryFormRow>

    <DirectoryImageField
      :label="t('admin.directory.collections.cover_url')"
      :value="props.form.coverUrl"
      @change="(url: string) => (props.form.coverUrl = url)"
    />

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
          <UiSelectItem value="draft">{{ t('admin.directory.status_draft') }}</UiSelectItem>
        </UiSelectContent>
      </UiSelect>
    </div>
  </div>
</template>
