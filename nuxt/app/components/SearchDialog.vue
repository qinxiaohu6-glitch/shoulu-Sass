<script setup lang="ts">
import type { LocalizedTool, Tool } from '~~/shared/types/catalog'

const open = defineModel<boolean>('open', { default: false })

const { lang, isZh, pick } = useLang()
const localePath = useLocalePath()

const query = ref('')
const input = ref<HTMLInputElement | null>(null)

/**
 * Community listings are fetched the first time the dialog opens, not on page
 * load: the search box lives in the header of every page, and paying for a
 * database read on every visit just to make a modal searchable is a bad trade.
 * A failed fetch is retried on the next open rather than cached as "empty".
 */
const extra = ref<LocalizedTool[]>([])
let fetched = false

watch(open, async (isOpen) => {
  if (!isOpen || fetched) return
  fetched = true
  try {
    const res = await $fetch<{ ok: boolean; tools?: Tool[] }>('/api/tools')
    extra.value = (res?.tools ?? []).map((tool) => localizeTool(tool, lang.value))
  } catch {
    fetched = false
  }
})

const overrides = useOverrides()
const all = computed(() =>
  mergeDirectory(orderedTools(lang.value, overrides.value), extra.value, overrides.value),
)

/**
 * Client-side search over the catalogue. 30 records today, so a linear scan is
 * instant and needs no endpoint. Swap for a server search once the directory
 * outgrows a few hundred rows.
 */
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return all.value.slice(0, 6)

  const terms = q.split(/\s+/)
  return all.value
    .map((tool) => {
      const haystack = [tool.name, tool.short, tool.makerName, tool.category, ...tool.tags]
        .join(' ')
        .toLowerCase()
      const hits = terms.filter((term) => haystack.includes(term)).length
      // Name matches outrank body matches; everything else keeps list order.
      const nameHit = terms.filter((term) => tool.name.toLowerCase().includes(term)).length
      return { tool, score: hits + nameHit * 3 }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((r) => r.tool)
})

function close() {
  open.value = false
}

// ⌘K / Ctrl-K anywhere on the page opens the dialog; Nuxt UI's modal already
// handles Escape.
function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value = !open.value
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

watch(open, async (value) => {
  if (value) {
    query.value = ''
    await nextTick()
    input.value?.focus()
  }
})
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'max-w-xl p-0' }">
    <template #content>
      <div class="flex items-center gap-2.5 border-b border-[var(--border)] px-4">
        <UIcon name="lucide:search" class="size-4 shrink-0 text-[var(--muted-foreground)]" />
        <input
          ref="input"
          v-model="query"
          type="search"
          :placeholder="pick('搜索产品、分类或标签…', 'Search products, categories or tags…')"
          class="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
        >
        <kbd class="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
          esc
        </kbd>
      </div>

      <div class="max-h-[60vh] overflow-y-auto p-2">
        <p
          v-if="!results.length"
          class="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]"
        >
          {{ pick('没有匹配的产品。', 'No products match that.') }}
        </p>

        <NuxtLink
          v-for="tool in results"
          :key="tool.slug"
          :to="localePath(`/products/${tool.slug}`)"
          class="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-[var(--secondary)]"
          @click="close"
        >
          <ToolLogo
            :logo="tool.logo"
            :name="tool.name"
            :size="28"
            decorative
            class="size-7 shrink-0 rounded-md border border-[var(--border)] bg-white object-contain p-0.5"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ tool.name }}</span>
            <span class="block truncate text-xs text-[var(--muted-foreground)]">{{ tool.short }}</span>
          </span>
          <span class="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
            {{ tool.votes_week }}
          </span>
        </NuxtLink>
      </div>

      <div class="flex items-center justify-between border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted-foreground)]">
        <span>{{ isZh ? '回车打开 · Esc 关闭' : 'Enter to open · Esc to close' }}</span>
        <NuxtLink :to="localePath('/products')" class="hover:text-[var(--foreground)]" @click="close">
          {{ pick('浏览全部', 'Browse all') }} →
        </NuxtLink>
      </div>
    </template>
  </UModal>
</template>
