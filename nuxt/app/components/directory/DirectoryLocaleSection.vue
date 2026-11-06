<script setup lang="ts">
/**
 * Source `routes/admin/directory/-form-ui.tsx` — `DirectoryLocaleSection`.
 *
 * A two-tab segmented control (EN / 中文) that swaps which set of fields is
 * visible, so a form with four translated columns is not eight inputs tall.
 * Shared (non-translated) fields stay outside this block.
 *
 * The source keeps the active locale in component state; the form values for
 * both languages stay in the parent, which is why switching tabs never loses
 * what was typed in the other one.
 */
import { cn } from '~/utils/ui'

export type DirectoryFormLocale = 'en' | 'zh'
const DIRECTORY_FORM_LOCALES: DirectoryFormLocale[] = ['en', 'zh']

const { t } = useSettingsI18n()

const locale = ref<DirectoryFormLocale>('en')

/** Same labels the source reads from `config/locale`. */
const LOCALE_NAMES: Record<DirectoryFormLocale, string> = { en: 'English', zh: '中文' }
</script>

<template>
  <div class="bg-muted/20 space-y-3 rounded-lg border p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-muted-foreground text-xs font-medium">
        {{ t('admin.directory.common.content_locale') }}
      </p>
      <div
        role="tablist"
        :aria-label="t('admin.directory.common.content_locale')"
        class="bg-muted inline-flex h-8 items-center rounded-lg p-[3px]"
      >
        <button
          v-for="id in DIRECTORY_FORM_LOCALES"
          :key="id"
          type="button"
          role="tab"
          :aria-selected="locale === id"
          :class="
            cn(
              'inline-flex h-[calc(100%-1px)] items-center justify-center rounded-md px-3 text-sm font-medium transition-all',
              locale === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-foreground/60 hover:text-foreground',
            )
          "
          @click="locale = id"
        >
          {{ LOCALE_NAMES[id] ?? id }}
        </button>
      </div>
    </div>
    <div class="space-y-4">
      <slot :locale="locale" />
    </div>
    <p v-if="locale !== 'en'" class="text-muted-foreground text-xs">
      {{ t('admin.directory.common.locale_optional_hint') }}
    </p>
  </div>
</template>
