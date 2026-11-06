<script setup lang="ts">
/**
 * Source `components/image-uploader-grid.tsx` — the tile strip.
 *
 * Presentational on purpose, exactly like the source: the parent owns the file
 * list and every side effect, this only draws previews, the replace/remove
 * affordances and the dashed "add" tile.
 */
import { Image as ImageIcon, RefreshCw, Upload, X } from 'lucide-vue-next'
import { cn } from '~/utils/ui'
import { formatBytes, type ImageUploaderValue } from '~/utils/image-upload'

const props = withDefaults(
  defineProps<{
    items: ImageUploaderValue[]
    maxCount: number
    maxSizeMB: number
    allowMultiple?: boolean
    title?: string
    emptyHint?: string
    countLabel: string
    class?: string
  }>(),
  { allowMultiple: false },
)

defineEmits<{ replace: [string]; remove: [string]; openPicker: [] }>()

const { t } = useSettingsI18n()
</script>

<template>
  <div :class="props.class">
    <div
      v-if="props.title"
      class="mb-2 flex items-center justify-between text-sm font-medium text-foreground"
    >
      <div class="flex items-center gap-2">
        <ImageIcon class="h-4 w-4 text-primary" />
        <span>{{ props.title }}</span>
        <span class="text-xs text-primary">({{ props.countLabel }})</span>
      </div>
    </div>

    <div :class="cn('flex gap-4', props.allowMultiple ? 'flex-wrap' : 'flex-nowrap')">
      <div
        v-for="item in props.items"
        :key="item.id"
        class="group relative overflow-hidden rounded-xl border border-border bg-muted/50 p-1 shadow-sm transition hover:border-border hover:bg-muted"
      >
        <div class="relative overflow-hidden rounded-lg">
          <img :src="item.preview" alt="Preview" class="h-32 w-32 rounded-lg object-cover">

          <span
            v-if="item.size"
            class="absolute bottom-2 left-2 rounded-md bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground"
          >
            {{ formatBytes(item.size) }}
          </span>

          <div
            v-if="item.status !== 'uploading'"
            class="absolute inset-0 z-10 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <UiButton
              type="button"
              size="icon"
              variant="secondary"
              class="h-10 w-10 rounded-full bg-background/50 text-foreground shadow-sm backdrop-blur hover:bg-background/50 focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Replace image"
              @click="$emit('replace', item.id)"
            >
              <RefreshCw class="h-5 w-5" />
            </UiButton>
          </div>

          <div
            v-if="item.status === 'uploading'"
            class="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-xs font-medium text-white"
          >
            Uploading...
          </div>

          <div
            v-if="item.status === 'error'"
            class="absolute inset-0 z-10 flex items-center justify-center bg-red-500/70 text-xs font-medium text-white"
          >
            Failed
          </div>

          <UiButton
            type="button"
            size="icon"
            variant="destructive"
            class="absolute top-2 right-2 z-20 h-7 w-7"
            aria-label="Remove image"
            @click="$emit('remove', item.id)"
          >
            <X class="h-4 w-4" />
          </UiButton>
        </div>
      </div>

      <div
        v-if="props.items.length < props.maxCount"
        class="group relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/50 p-1 shadow-sm transition hover:border-border hover:bg-muted"
      >
        <div class="relative overflow-hidden rounded-lg">
          <button
            type="button"
            class="flex h-32 w-32 flex-col items-center justify-center gap-2"
            @click="$emit('openPicker')"
          >
            <div
              class="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border"
            >
              <Upload class="h-5 w-5" />
            </div>
            <span class="text-xs font-medium">{{ t('common.upload.label') }}</span>
            <span class="text-xs text-primary">
              {{ t('common.upload.max_mb', { max: props.maxSizeMB }) }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="!props.title && props.emptyHint" class="mt-2 text-xs text-muted-foreground">
      {{ props.emptyHint }}
    </div>
  </div>
</template>
