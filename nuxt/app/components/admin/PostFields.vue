<script setup lang="ts">
/**
 * Source `routes/admin/-posts-fields.tsx` — the seven fields shared by the
 * create and the edit dialog, in the source's order.
 *
 * The form object is passed by reference and mutated in place; the parent owns
 * it (and resets it when a dialog opens), exactly as the source's
 * `renderPostFields(form, categoryOptions)` does.
 */
import type { CategoryOption, PostForm } from '~/utils/admin-posts-ui'

const props = defineProps<{
  form: PostForm
  categories: CategoryOption[]
}>()

const { t } = useSettingsI18n()

const statusText = computed(() => {
  const value = props.form.status || 'draft'
  return value === 'published' ? t('admin.posts.status_published') : t('admin.posts.status_draft')
})

const categoryText = computed(() => {
  const hit = props.categories.find((c) => c.id === props.form.categories)
  return hit ? hit.title : ''
})
</script>

<template>
  <div class="space-y-4 py-4">
    <div class="space-y-1.5">
      <UiLabel>{{ t('admin.posts.slug_field') }}</UiLabel>
      <UiInput v-model="props.form.slug" :placeholder="t('admin.posts.slug_placeholder')" />
    </div>

    <div class="space-y-1.5">
      <UiLabel>{{ t('admin.posts.title_field') }}</UiLabel>
      <UiInput v-model="props.form.title" :placeholder="t('admin.posts.title_placeholder')" />
    </div>

    <div class="space-y-1.5">
      <UiLabel>{{ t('admin.posts.description_field') }}</UiLabel>
      <UiInput
        v-model="props.form.description"
        :placeholder="t('admin.posts.description_placeholder')"
      />
    </div>

    <div class="space-y-1.5">
      <UiLabel>{{ t('admin.posts.author_field') }}</UiLabel>
      <UiInput
        v-model="props.form.authorName"
        :placeholder="t('admin.posts.author_placeholder')"
      />
    </div>

    <div class="space-y-2">
      <UiLabel>{{ t('admin.posts.category_field') }}</UiLabel>
      <UiSelect v-model="props.form.categories">
        <UiSelectTrigger>
          <UiSelectValue
            :text="categoryText"
            :placeholder="t('admin.posts.category_placeholder')"
          />
        </UiSelectTrigger>
        <UiSelectContent>
          <UiSelectItem v-for="c in props.categories" :key="c.id" :value="c.id">
            {{ c.title }}
          </UiSelectItem>
        </UiSelectContent>
      </UiSelect>
    </div>

    <div class="space-y-2">
      <UiLabel>{{ t('admin.posts.status_field') }}</UiLabel>
      <UiSelect v-model="props.form.status">
        <UiSelectTrigger>
          <UiSelectValue :text="statusText" />
        </UiSelectTrigger>
        <UiSelectContent>
          <UiSelectItem value="draft">{{ t('admin.posts.status_draft') }}</UiSelectItem>
          <UiSelectItem value="published">{{ t('admin.posts.status_published') }}</UiSelectItem>
        </UiSelectContent>
      </UiSelect>
    </div>

    <div class="space-y-2">
      <UiLabel>{{ t('admin.posts.content_field') }}</UiLabel>
      <RichTextEditor
        :value="props.form.content"
        :placeholder="t('admin.posts.content_placeholder')"
        @change="(md: string) => (props.form.content = md)"
      />
    </div>
  </div>
</template>
