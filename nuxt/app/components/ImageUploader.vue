<script setup lang="ts">
/**
 * Source `components/image-uploader.tsx` (+ `-upload.ts`, `-grid.tsx`).
 *
 * Same behaviours, in the same order: click to pick, drag-and-drop, paste from
 * the clipboard, one replace picker per tile, a hard cap on the number of
 * images and on each file's size, and a per-tile `uploading → uploaded|error`
 * state driven by the real request rather than by a timer.
 *
 * React's `setItems(prev => …)` becomes a plain reactive array here; every
 * mutation still re-reads the array it is about to write, because two uploads
 * finishing out of order must not clobber each other's tile.
 */
import { cn } from '~/utils/ui'
import { toast } from 'vue-sonner'
import {
  uploadImageFile,
  type ImageUploaderValue,
  type UploadItem,
  type UploadStatus,
} from '~/utils/image-upload'

const props = withDefaults(
  defineProps<{
    allowMultiple?: boolean
    maxImages?: number
    maxSizeMB?: number
    title?: string
    emptyHint?: string
    class?: string
    defaultPreviews?: string[]
  }>(),
  { allowMultiple: false, maxImages: 1, maxSizeMB: 10 },
)

const emit = defineEmits<{ change: [ImageUploaderValue[]] }>()

const { t } = useSettingsI18n()

const presetItems = (urls: string[]): UploadItem[] =>
  urls.map((url, index) => ({
    id: `preset-${url}-${index}`,
    preview: url,
    url,
    status: 'uploaded' as UploadStatus,
  }))

const items = ref<UploadItem[]>(presetItems(props.defaultPreviews ?? []))
const inputEl = ref<HTMLInputElement | null>(null)
const replaceTargetId = ref<string | null>(null)
const isDragActive = ref(false)
const dragCounter = ref(0)

const maxCount = computed(() => (props.allowMultiple ? props.maxImages : 1))
const maxBytes = computed(() => props.maxSizeMB * 1024 * 1024)
const countLabel = computed(() => `${items.value.length}/${maxCount.value}`)

/**
 * The source skips the very first effect run, so the empty initial list is not
 * reported back to the parent. A non-immediate `watch` has exactly that
 * behaviour: nothing fires until the list actually changes.
 */
watch(items, (next) => {
  emit(
    'change',
    next.map(({ id, preview, url, status, size }) => ({ id, preview, url, status, size })),
  )
})

onBeforeUnmount(() => {
  for (const item of items.value) {
    if (item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview)
  }
})

/* ── upload ───────────────────────────────────────────────────────────── */

function revoke(item: UploadItem) {
  if (item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview)
}

function replaceUploadItems(pairs: Array<{ id: string; file: File }>) {
  for (const { id, file } of pairs) {
    const uploadKey = `${Date.now()}-${Math.random()}`
    const nextPreview = URL.createObjectURL(file)

    items.value = items.value.map((item) => {
      if (item.id !== id) return item
      revoke(item)
      return {
        ...item,
        preview: nextPreview,
        file,
        size: file.size,
        url: undefined,
        status: 'uploading' as UploadStatus,
        uploadKey,
      }
    })

    uploadImageFile(file, t)
      .then((url) => {
        items.value = items.value.map((item) => {
          if (item.id !== id) return item
          if (item.uploadKey !== uploadKey) return item
          revoke(item)
          return { ...item, preview: url, url, status: 'uploaded' as UploadStatus, file: undefined }
        })
      })
      .catch((error: Error) => {
        console.error('Upload failed:', error)
        toast.error(error.message || t('common.upload.failed'))
        items.value = items.value.map((item) => {
          if (item.id !== id) return item
          if (item.uploadKey !== uploadKey) return item
          return { ...item, status: 'error' as UploadStatus }
        })
      })
      .finally(() => {
        if (inputEl.value) inputEl.value.value = ''
      })
  }
}

function handleFiles(selectedFiles: File[]) {
  const replaceId = replaceTargetId.value
  if (replaceId) {
    replaceTargetId.value = null
    const file = selectedFiles[0]
    if (!file) return
    if (!file.type?.startsWith('image/')) {
      toast.error(t('common.upload.only_images'))
      if (inputEl.value) inputEl.value.value = ''
      return
    }
    if (file.size > maxBytes.value) {
      toast.error(t('common.upload.exceeds_limit', { name: file.name, max: props.maxSizeMB }))
      if (inputEl.value) inputEl.value.value = ''
      return
    }
    replaceUploadItems([{ id: replaceId, file }])
    return
  }

  const availableSlots = maxCount.value - items.value.length
  const filesToAdd = selectedFiles
    .filter((file) => {
      if (!file.type?.startsWith('image/')) {
        toast.error(t('common.upload.not_image', { name: file.name }))
        return false
      }
      if (file.size > maxBytes.value) {
        toast.error(t('common.upload.exceeds_limit', { name: file.name, max: props.maxSizeMB }))
        return false
      }
      return true
    })
    .slice(0, Math.max(availableSlots, 0))

  if (!filesToAdd.length) {
    /* No room left: the source reuses the tail of the strip instead of
       refusing outright, so a full uploader still accepts a replacement. */
    if (items.value.length) {
      const normalized = selectedFiles.filter((file) => file.type?.startsWith('image/'))
      if (!normalized.length) return

      const k = Math.min(normalized.length, items.value.length)
      const tail = items.value.slice(-k)
      const pairs: Array<{ id: string; file: File }> = []

      for (let i = 0; i < k; i += 1) {
        const targetId = tail[tail.length - 1 - i]?.id
        const file = normalized[i]
        if (targetId && file) pairs.push({ id: targetId, file })
      }

      if (pairs.length) replaceUploadItems(pairs)
    }

    if (inputEl.value) inputEl.value.value = ''
    return
  }

  if (availableSlots < selectedFiles.length) {
    toast.message(t('common.upload.only_first_n', { count: filesToAdd.length }))
  }

  const newItems: UploadItem[] = filesToAdd.map((file) => ({
    id: `${file.name}-${file.lastModified}-${Math.random()}`,
    preview: URL.createObjectURL(file),
    file,
    size: file.size,
    status: 'uploading' as UploadStatus,
    uploadKey: `${Date.now()}-${Math.random()}`,
  }))

  items.value = [...items.value, ...newItems]

  Promise.all(
    newItems.map(async (item) => {
      try {
        const url = await uploadImageFile(item.file as File, t)
        items.value = items.value.map((current) => {
          if (current.id !== item.id) return current
          if (current.uploadKey && item.uploadKey && current.uploadKey !== item.uploadKey) {
            return current
          }
          revoke(current)
          return {
            ...current,
            preview: url,
            url,
            status: 'uploaded' as UploadStatus,
            file: undefined,
          }
        })
      } catch (error: any) {
        console.error('Upload failed:', error)
        toast.error(error?.message || t('common.upload.failed'))
        items.value = items.value.map((current) => {
          if (current.id !== item.id) return current
          if (current.uploadKey && current.uploadKey !== item.uploadKey) return current
          return { ...current, status: 'error' as UploadStatus }
        })
      }
    }),
  )

  if (inputEl.value) inputEl.value.value = ''
}

/* ── input events ─────────────────────────────────────────────────────── */

function onSelect(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!files.length) return
  handleFiles(files)
}

function onPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean) as File[]

  if (!files.length) return
  event.preventDefault()
  handleFiles(files)
}

function onDragEnter(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  dragCounter.value += 1
  isDragActive.value = true
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  if (!isDragActive.value) isDragActive.value = true
}

function onDragLeave(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  dragCounter.value -= 1
  if (dragCounter.value <= 0) {
    dragCounter.value = 0
    isDragActive.value = false
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  dragCounter.value = 0
  isDragActive.value = false

  const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
    file.type?.startsWith('image/'),
  )
  if (!files.length) return
  handleFiles(files)
}

function remove(id: string) {
  const removed = items.value.find((item) => item.id === id)
  if (removed) revoke(removed)
  items.value = items.value.filter((item) => item.id !== id)
}

function openFilePicker() {
  inputEl.value?.click()
}

function openReplacePicker(id: string) {
  replaceTargetId.value = id
  openFilePicker()
}
</script>

<template>
  <div
    :class="
      cn(
        'relative focus:outline-none',
        isDragActive && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background',
        props.class,
      )
    "
    tabindex="0"
    @paste="onPaste"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div
      v-if="isDragActive"
      class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/10 backdrop-blur-sm"
    >
      <div
        class="rounded-full bg-background/80 px-4 py-2 text-sm font-medium text-foreground shadow-sm"
      >
        Drop to upload
      </div>
    </div>

    <input
      ref="inputEl"
      type="file"
      accept="image/*"
      :multiple="props.allowMultiple"
      class="hidden"
      @change="onSelect"
    >

    <ImageUploaderGrid
      :title="props.title"
      :empty-hint="props.emptyHint"
      :count-label="countLabel"
      :items="items"
      :max-count="maxCount"
      :max-size-m-b="props.maxSizeMB"
      :allow-multiple="props.allowMultiple"
      @replace="openReplacePicker"
      @remove="remove"
      @open-picker="openFilePicker"
    />
  </div>
</template>
