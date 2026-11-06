<script setup lang="ts">
/**
 * Source `routes/admin/directory/-form-ui.tsx` — `DirectoryImageField`.
 *
 * Single-image upload for an icon or cover. Remounts when `value` changes so
 * the uploader's initial-preview state picks up a URL that arrived later (an
 * edit form filling in after its row was clicked) — the source does the same
 * with `key={value || '__empty__'}` and a `useMemo` of the preview list.
 *
 * The current value is kept while an upload is in flight; it is only cleared
 * when the tile list is emptied. Clearing it mid-upload would blank the icon
 * the user is replacing.
 */
import type { ImageUploaderValue } from '~/utils/image-upload'

const props = withDefaults(
  defineProps<{ label: string; value: string; maxSizeMB?: number }>(),
  { maxSizeMB: 2 },
)

const emit = defineEmits<{ change: [string] }>()

const previews = computed(() => (props.value ? [props.value] : []))

function onChange(items: ImageUploaderValue[]) {
  const uploaded = items.find((item) => item.status === 'uploaded' && item.url)
  if (uploaded?.url) {
    emit('change', uploaded.url)
    return
  }
  const busy = items.some((item) => item.status === 'uploading')
  if (!busy && items.length === 0) emit('change', '')
}
</script>

<template>
  <div class="space-y-2">
    <UiLabel>{{ props.label }}</UiLabel>
    <ImageUploader
      :key="props.value || '__empty__'"
      :max-size-m-b="props.maxSizeMB"
      :default-previews="previews"
      @change="onChange"
    />
  </div>
</template>
