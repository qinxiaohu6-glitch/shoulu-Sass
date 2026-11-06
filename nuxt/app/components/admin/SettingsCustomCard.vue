<script setup lang="ts">
/**
 * Source `routes/admin/-settings-custom.tsx` — the "Custom" tab.
 *
 * Arbitrary `key` / `value` pairs for keys the registry does not know about.
 * Rows live in the page's state; the Save button posts them all at once.
 */
import { Minus, Plus } from 'lucide-vue-next'
import type { CustomRow } from '~/utils/admin-settings-ui'

const rows = defineModel<CustomRow[]>({ required: true })

const { t } = useSettingsI18n()

function update(index: number, field: 'key' | 'value', value: string) {
  rows.value = rows.value.map((row, i) => (i === index ? { ...row, [field]: value } : row))
}
</script>

<template>
  <UiCard>
    <UiCardHeader>
      <UiCardTitle>{{ t('admin.settings.custom.title') }}</UiCardTitle>
      <p class="text-muted-foreground text-sm">{{ t('admin.settings.custom.description') }}</p>
    </UiCardHeader>
    <UiCardContent class="space-y-4">
      <p v-if="rows.length === 0" class="text-muted-foreground text-sm">
        {{ t('admin.settings.custom.empty') }}
      </p>
      <div v-for="(row, i) in rows" :key="i" class="flex items-start gap-2">
        <UiInput
          :model-value="row.key"
          class="w-1/3 shrink-0 font-mono"
          :placeholder="t('admin.settings.custom.key_placeholder')"
          @update:model-value="(v: string | number | undefined) => update(i, 'key', String(v ?? ''))"
        />
        <textarea
          :value="row.value"
          :placeholder="t('admin.settings.custom.value_placeholder')"
          rows="1"
          class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 max-h-48 min-h-8 flex-1 resize-y rounded-lg border bg-transparent px-2.5 py-1 text-base leading-6 transition-colors outline-none focus-visible:ring-3 md:text-sm"
          @input="update(i, 'value', ($event.target as HTMLTextAreaElement).value)"
        />
        <UiButton
          variant="outline"
          size="icon"
          class="shrink-0"
          :aria-label="t('admin.settings.custom.remove')"
          @click="rows = rows.filter((_, j) => j !== i)"
        >
          <Minus class="size-4" />
        </UiButton>
      </div>
      <UiButton
        variant="outline"
        class="gap-1.5"
        @click="rows = [...rows, { key: '', value: '' }]"
      >
        <Plus class="size-4" />
        {{ t('admin.settings.custom.add') }}
      </UiButton>
    </UiCardContent>
  </UiCard>
</template>
