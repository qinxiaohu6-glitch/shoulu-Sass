<script setup lang="ts">
/**
 * Source `routes/admin/directory/-tools-form.tsx` — `renderToolFields`.
 *
 * One field set for both drawers. `lockMeta` is the edit form: the slug is the
 * public listing URL, and `source` / `status` are owned by the list's row
 * actions (Approve / Reject / Force unpublish), so editing a row cannot change
 * them. The source says the same with `opts?.lockMeta` and two hint lines.
 *
 * The pricing / category selects stay editable in both modes — re-filing a
 * listing or correcting its price is ordinary editorial work, not a moderation
 * decision.
 */
import type { DirOption, ToolFormValues } from '~/utils/admin-tools-ui'

const props = withDefaults(
  defineProps<{ form: ToolFormValues; categories: DirOption[]; tags: DirOption[]; lockMeta?: boolean }>(),
  { lockMeta: false },
)

const { t } = useSettingsI18n()

const pricingLabel = computed(() => t(`directory.pricing_${props.form.pricing || 'free'}`))

const categoryLabel = computed(() => {
  if (!props.form.categoryId) return t('admin.directory.tools.no_category')
  return props.categories.find((c) => c.id === props.form.categoryId)?.name ?? t('admin.directory.tools.no_category')
})

const sourceLabel = computed(() => t(`admin.directory.source_${props.form.source}`))
const statusLabel = computed(() => t(`admin.directory.status_${props.form.status}`))

/** The source's `__none__` sentinel: reka-ui reserves `''` for "no selection". */
const NO_CATEGORY = '__none__'

const categoryValue = computed(() => props.form.categoryId || NO_CATEGORY)

/**
 * `logoSrc` only for the preview, never for the value.
 *
 * Catalogue icons are stored repo-relative (`assets/img/icons/chatgpt.png`) and
 * `ToolLogo` resolves them with a leading slash at render time. The uploader
 * needs the same resolved URL to show a thumbnail, but the form must keep the
 * stored string — rewriting it here would send `/<path>` back to the API on a
 * save that never touched the icon.
 */
const iconPreview = computed(() => logoSrc(props.form.iconUrl))

function onCategoryChange(value: unknown) {
  const next = String(value ?? '')
  props.form.categoryId = next === NO_CATEGORY ? '' : next
}

function toggleTag(id: string, checked: boolean) {
  props.form.tagIds = checked
    ? [...props.form.tagIds, id]
    : props.form.tagIds.filter((tagId) => tagId !== id)
}
</script>

<template>
  <div class="space-y-4">
    <DirectoryLocaleSection v-slot="{ locale }">
      <DirectoryTextField
        :model-value="locale === 'en' ? props.form.name : props.form.nameZh"
        :label="t('admin.directory.common.name')"
        @update:model-value="(v: string) => (locale === 'en' ? (props.form.name = v) : (props.form.nameZh = v))"
      />
      <DirectoryTextField
        :model-value="locale === 'en' ? props.form.tagline : props.form.taglineZh"
        :label="t('admin.directory.tools.tagline')"
        @update:model-value="(v: string) => (locale === 'en' ? (props.form.tagline = v) : (props.form.taglineZh = v))"
      />
      <DirectoryTextField
        :model-value="locale === 'en' ? props.form.introduction : props.form.introductionZh"
        :label="t('admin.directory.tools.introduction')"
        @update:model-value="
          (v: string) => (locale === 'en' ? (props.form.introduction = v) : (props.form.introductionZh = v))
        "
      />
    </DirectoryLocaleSection>

    <DirectoryFormRow>
      <DirectoryTextField
        v-model="props.form.slug"
        :label="t('admin.directory.common.slug')"
        :disabled="props.lockMeta"
      />
      <DirectoryTextField v-model="props.form.websiteUrl" :label="t('admin.directory.tools.website')" />
    </DirectoryFormRow>
    <p v-if="props.lockMeta" class="text-muted-foreground -mt-2 text-xs">
      {{ t('admin.directory.common.slug_locked_hint') }}
    </p>

    <DirectoryImageField
      :label="t('admin.directory.tools.icon_url')"
      :value="iconPreview"
      @change="(url: string) => (props.form.iconUrl = url)"
    />

    <DirectoryFormRow>
      <DirectoryTextField v-model="props.form.authorName" :label="t('admin.directory.tools.author')" />
      <div class="space-y-1">
        <DirectoryTextField v-model="props.form.sort" :label="t('admin.directory.tools.sort')" type="number" />
        <p class="text-muted-foreground text-xs">{{ t('admin.directory.tools.sort_hint') }}</p>
      </div>
    </DirectoryFormRow>

    <DirectoryFormRow>
      <div class="space-y-2">
        <UiLabel>{{ t('admin.directory.tools.pricing') }}</UiLabel>
        <UiSelect
          :model-value="props.form.pricing || 'free'"
          @update:model-value="(v: string) => (props.form.pricing = String(v || 'free'))"
        >
          <UiSelectTrigger class="w-full">
            <UiSelectValue :text="pricingLabel" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem value="free">{{ t('directory.pricing_free') }}</UiSelectItem>
            <UiSelectItem value="freemium">{{ t('directory.pricing_freemium') }}</UiSelectItem>
            <UiSelectItem value="paid">{{ t('directory.pricing_paid') }}</UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>

      <div class="space-y-2">
        <UiLabel>{{ t('admin.directory.tools.category') }}</UiLabel>
        <UiSelect :model-value="categoryValue" @update:model-value="onCategoryChange">
          <UiSelectTrigger class="w-full">
            <UiSelectValue :text="categoryLabel" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem :value="NO_CATEGORY">{{ t('admin.directory.tools.no_category') }}</UiSelectItem>
            <UiSelectItem v-for="c in props.categories" :key="c.id" :value="c.id">{{ c.name }}</UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>
    </DirectoryFormRow>

    <p v-if="props.lockMeta" class="text-muted-foreground text-xs">
      {{ t('admin.directory.tools.meta_locked_hint') }}
    </p>
    <DirectoryFormRow>
      <div class="space-y-2">
        <UiLabel>{{ t('admin.directory.tools.source') }}</UiLabel>
        <UiSelect
          :model-value="props.form.source"
          :disabled="props.lockMeta"
          @update:model-value="(v: string) => (props.form.source = String(v || 'editorial'))"
        >
          <UiSelectTrigger class="w-full" :disabled="props.lockMeta">
            <UiSelectValue :text="sourceLabel" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem value="editorial">{{ t('admin.directory.source_editorial') }}</UiSelectItem>
            <UiSelectItem value="community">{{ t('admin.directory.source_community') }}</UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>

      <div class="space-y-2">
        <UiLabel>{{ t('admin.directory.common.status') }}</UiLabel>
        <UiSelect
          :model-value="props.form.status"
          :disabled="props.lockMeta"
          @update:model-value="(v: string) => (props.form.status = String(v || 'published'))"
        >
          <UiSelectTrigger class="w-full" :disabled="props.lockMeta">
            <UiSelectValue :text="statusLabel" />
          </UiSelectTrigger>
          <UiSelectContent>
            <UiSelectItem value="published">{{ t('admin.directory.status_published') }}</UiSelectItem>
            <UiSelectItem value="pending">{{ t('admin.directory.status_pending') }}</UiSelectItem>
            <UiSelectItem value="pending_payment">{{ t('admin.directory.status_pending_payment') }}</UiSelectItem>
            <UiSelectItem value="rejected">{{ t('admin.directory.status_rejected') }}</UiSelectItem>
          </UiSelectContent>
        </UiSelect>
      </div>
    </DirectoryFormRow>

    <!-- Ranking / badge flags — not taxonomy (tags are below). -->
    <div class="bg-muted/20 space-y-3 rounded-lg border p-3">
      <div class="space-y-1">
        <p class="text-sm font-medium">{{ t('admin.directory.tools.listing_flags') }}</p>
        <p class="text-muted-foreground text-xs">{{ t('admin.directory.tools.listing_flags_hint') }}</p>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="bg-background flex cursor-pointer gap-2 rounded-md border p-3 text-sm">
          <UiCheckbox
            :model-value="props.form.featured"
            class="mt-0.5"
            @update:model-value="(v: boolean | 'indeterminate') => (props.form.featured = v === true)"
          />
          <span class="min-w-0 space-y-0.5">
            <span class="block font-medium">{{ t('admin.directory.tools.featured') }}</span>
            <span class="text-muted-foreground block text-xs leading-snug">
              {{ t('admin.directory.tools.featured_hint') }}
            </span>
          </span>
        </label>
        <label class="bg-background flex cursor-pointer gap-2 rounded-md border p-3 text-sm">
          <UiCheckbox
            :model-value="props.form.sponsored"
            class="mt-0.5"
            @update:model-value="(v: boolean | 'indeterminate') => (props.form.sponsored = v === true)"
          />
          <span class="min-w-0 space-y-0.5">
            <span class="block font-medium">{{ t('admin.directory.tools.sponsored') }}</span>
            <span class="text-muted-foreground block text-xs leading-snug">
              {{ t('admin.directory.tools.sponsored_hint') }}
            </span>
          </span>
        </label>
      </div>
    </div>

    <div class="space-y-2">
      <div class="space-y-1">
        <UiLabel>{{ t('admin.directory.tools.tags') }}</UiLabel>
        <p class="text-muted-foreground text-xs">{{ t('admin.directory.tools.tags_hint') }}</p>
      </div>
      <div class="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        <label
          v-for="tag in props.tags"
          :key="tag.id"
          class="flex items-center gap-2 text-sm"
        >
          <UiCheckbox
            :model-value="props.form.tagIds.includes(tag.id)"
            @update:model-value="(v: boolean | 'indeterminate') => toggleTag(tag.id, v === true)"
          />
          <span class="truncate">{{ tag.name }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
