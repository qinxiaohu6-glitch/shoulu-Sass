<script setup lang="ts">
/**
 * Source `routes/admin/directory/-collections-tools-dialog.tsx`.
 *
 * A drawer with two lists: the ordered members (with up / down / remove) and
 * the pool of tools that could still be added, searchable by name or slug.
 * Saving writes the whole ordered list back in one PUT.
 *
 * The source calls this a dialog but renders `DirectoryFormDrawer`, so it slides
 * in from the right like every other console form. Same here.
 */
import { ChevronDown, ChevronUp, X } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { DirCollection, ToolOption } from '~/utils/admin-collections-ui'

const props = withDefaults(
  defineProps<{
    collection: DirCollection | null
    tools: ToolOption[]
    toolsLoading?: boolean
  }>(),
  { toolsLoading: false },
)

const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useSettingsI18n()
const api = useAdminApi()

const toolIds = ref<string[]>([])
const filter = ref('')
const saving = ref(false)

watch(
  () => props.collection,
  (collection) => {
    if (!collection) return
    toolIds.value = [...(collection.toolIds || [])]
    filter.value = ''
  },
)

const toolMap = computed(() => new Map(props.tools.map((tool) => [tool.id, tool])))
const selected = computed(() =>
  toolIds.value.map((id) => toolMap.value.get(id)).filter((tool): tool is ToolOption => Boolean(tool)),
)

const available = computed(() => {
  const chosen = new Set(toolIds.value)
  const q = filter.value.trim().toLowerCase()
  return props.tools.filter((tool) => {
    if (chosen.has(tool.id)) return false
    if (!q) return true
    return tool.name.toLowerCase().includes(q) || tool.slug.toLowerCase().includes(q)
  })
})

function move(id: string, delta: -1 | 1) {
  const index = toolIds.value.indexOf(id)
  if (index < 0) return
  const next = index + delta
  if (next < 0 || next >= toolIds.value.length) return
  const list = [...toolIds.value]
  const tmp = list[index]!
  list[index] = list[next]!
  list[next] = tmp
  toolIds.value = list
}

function add(id: string) {
  if (toolIds.value.includes(id)) return
  toolIds.value = [...toolIds.value, id]
}

function remove(id: string) {
  toolIds.value = toolIds.value.filter((value) => value !== id)
}

async function save() {
  const collection = props.collection
  if (!collection) return
  saving.value = true
  try {
    await api.put('/api/admin/directory/collections', { id: collection.id, toolIds: toolIds.value })
    toast.success(t('admin.directory.collections.tools_saved'))
    emit('saved')
    emit('close')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DirectoryFormDrawer
    :open="!!props.collection"
    :title="t('admin.directory.collections.manage_tools_title')"
    :description="
      props.collection
        ? t('admin.directory.collections.manage_tools_description', {
            name: props.collection.nameZh || props.collection.name,
          })
        : ''
    "
    @update:open="(v: boolean) => !v && emit('close')"
  >
    <DirectoryFormBody>
      <div class="space-y-4">
        <div class="space-y-2">
          <p class="text-sm font-medium">
            {{ t('admin.directory.collections.selected_tools') }}
            <span class="text-muted-foreground ml-1 tabular-nums">({{ selected.length }})</span>
          </p>
          <p v-if="selected.length === 0" class="text-muted-foreground text-sm">
            {{ t('admin.directory.collections.tools_hint') }}
          </p>
          <ul v-else class="space-y-1">
            <li
              v-for="(tool, index) in selected"
              :key="tool.id"
              class="bg-muted/40 flex items-center gap-1 rounded-md px-2 py-1.5"
            >
              <span class="text-muted-foreground w-5 shrink-0 text-xs tabular-nums">{{ index + 1 }}</span>
              <span class="min-w-0 flex-1 truncate text-sm">{{ tool.name }}</span>
              <UiButton
                type="button"
                variant="ghost"
                size="icon"
                class="size-7"
                :disabled="index === 0"
                :aria-label="t('admin.directory.collections.move_up')"
                @click="move(tool.id, -1)"
              >
                <ChevronUp class="size-3.5" />
              </UiButton>
              <UiButton
                type="button"
                variant="ghost"
                size="icon"
                class="size-7"
                :disabled="index === selected.length - 1"
                :aria-label="t('admin.directory.collections.move_down')"
                @click="move(tool.id, 1)"
              >
                <ChevronDown class="size-3.5" />
              </UiButton>
              <UiButton
                type="button"
                variant="ghost"
                size="icon"
                class="size-7"
                :aria-label="t('admin.directory.common.delete')"
                @click="remove(tool.id)"
              >
                <X class="size-3.5" />
              </UiButton>
            </li>
          </ul>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium">{{ t('admin.directory.collections.available_tools') }}</p>
          <UiInput v-model="filter" :placeholder="t('admin.directory.collections.tools_search')" />
          <p v-if="props.toolsLoading" class="text-muted-foreground text-sm">{{ t('admin.loading') }}</p>
          <p v-else-if="props.tools.length === 0" class="text-muted-foreground text-sm">
            {{ t('admin.directory.collections.no_tools') }}
          </p>
          <p v-else-if="available.length === 0" class="text-muted-foreground text-sm">
            {{ t('admin.directory.collections.no_match_tools') }}
          </p>
          <div v-else class="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            <label
              v-for="tool in available"
              :key="tool.id"
              class="flex cursor-pointer items-center gap-2 text-sm"
            >
              <UiCheckbox :model-value="false" @update:model-value="(v: any) => v && add(tool.id)" />
              <span class="truncate">{{ tool.name }}</span>
            </label>
          </div>
        </div>
      </div>

      <template #actions>
        <UiButton type="button" variant="outline" @click="emit('close')">
          {{ t('admin.directory.common.cancel') }}
        </UiButton>
        <UiButton type="button" :disabled="saving || !props.collection" @click="save">
          {{ t('admin.directory.common.save') }}
        </UiButton>
      </template>
    </DirectoryFormBody>
  </DirectoryFormDrawer>
</template>
