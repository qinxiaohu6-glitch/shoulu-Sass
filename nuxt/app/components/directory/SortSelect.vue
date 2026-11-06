<script setup lang="ts">
/**
 * Ported from `shipany-dir/src/components/directory/DirectorySortSelect.tsx`.
 *
 * `UiSelectValue` needs the label passed as `text`: reka-ui only knows an item's
 * label while the popup is mounted, so a closed trigger would otherwise fall back
 * to the raw value ("popular"). The source solved the same problem by walking the
 * item tree; here the label is simply looked up from the same list the items come
 * from.
 */
import type { DirectorySortValue } from '~/utils/directory-ui'

const props = defineProps<{ value: string }>()
const emit = defineEmits<{ change: [value: DirectorySortValue] }>()

const t = useDirectoryCopy()

const options = computed<{ value: DirectorySortValue; label: string }[]>(() => [
  { value: 'recommended', label: t('directory.sort.recommended') },
  { value: 'popular', label: t('directory.sort.popular') },
  { value: 'latest', label: t('directory.sort.latest') },
  { value: 'name', label: t('directory.sort.name') },
])

const current = computed(
  () => options.value.find((option) => option.value === props.value)?.label ?? '',
)
</script>

<template>
  <UiSelect
    :model-value="props.value"
    @update:model-value="(next: string) => next && emit('change', next as DirectorySortValue)"
  >
    <UiSelectTrigger
      class="h-8 min-w-36"
      size="sm"
      :aria-label="t('directory.sort_by')"
    >
      <UiSelectValue :text="current" />
    </UiSelectTrigger>
    <UiSelectContent align="end">
      <UiSelectItem v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </UiSelectItem>
    </UiSelectContent>
  </UiSelect>
</template>
