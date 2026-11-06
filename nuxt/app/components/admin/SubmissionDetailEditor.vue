<script setup lang="ts">
/**
 * Editor for the six long-form sections of one listing, in one language.
 *
 * The field shape is the source's `DetailBlock` (the same one
 * `AdminDetailFields.vue` edits and `ToolDetailSections` renders). This build
 * uses the console's shadcn Vue primitives instead of the legacy `.admin-input`
 * classes, because the review queue is a shadcn page and those classes have no
 * stylesheet in this project.
 *
 * The whole block is emitted on every edit; the parent keeps one draft and a
 * save either writes all of it or none of it.
 */
import type { DetailBlock, DetailFaq, DetailItem } from '~~/shared/types/catalog'
import { Minus, Plus } from 'lucide-vue-next'

const props = defineProps<{ modelValue: DetailBlock }>()
const emit = defineEmits<{ 'update:modelValue': [DetailBlock] }>()

type LineKey = 'how_to_use' | 'pros' | 'cons'
type PairKey = 'features' | 'use_cases'

const MAX_ROWS = 20

const LINE_GROUPS = [
  { key: 'how_to_use', label: '使用步骤', hint: '按顺序写，一步一行。' },
  { key: 'pros', label: '优点', hint: '一句话一条。' },
  { key: 'cons', label: '缺点', hint: '一句话一条；留空则该分区不显示。' },
] as const

const PAIR_GROUPS = [
  { key: 'features', label: '主要功能', hint: '标题 + 说明；说明可以不填。' },
  { key: 'use_cases', label: '适合谁用', hint: '标题 + 说明；说明可以不填。' },
] as const

const lineGroups = computed(() =>
  LINE_GROUPS.map((group) => ({ ...group, items: props.modelValue[group.key] })),
)
const pairGroups = computed(() =>
  PAIR_GROUPS.map((group) => ({ ...group, items: props.modelValue[group.key] })),
)

function replace(patch: Partial<DetailBlock>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function setLine(key: LineKey, index: number, value: string) {
  const next = [...props.modelValue[key]]
  next[index] = value
  replace({ [key]: next } as Partial<DetailBlock>)
}
function addLine(key: LineKey) {
  if (props.modelValue[key].length >= MAX_ROWS) return
  replace({ [key]: [...props.modelValue[key], ''] } as Partial<DetailBlock>)
}
function removeLine(key: LineKey, index: number) {
  replace({ [key]: props.modelValue[key].filter((_, i) => i !== index) } as Partial<DetailBlock>)
}

function setPair(key: PairKey, index: number, patch: Partial<DetailItem>) {
  const next = props.modelValue[key].map((item, i) => (i === index ? { ...item, ...patch } : item))
  replace({ [key]: next } as Partial<DetailBlock>)
}
function addPair(key: PairKey) {
  if (props.modelValue[key].length >= MAX_ROWS) return
  replace({ [key]: [...props.modelValue[key], { title: '', desc: '' }] } as Partial<DetailBlock>)
}
function removePair(key: PairKey, index: number) {
  replace({ [key]: props.modelValue[key].filter((_, i) => i !== index) } as Partial<DetailBlock>)
}

function setFaq(index: number, patch: Partial<DetailFaq>) {
  const next = props.modelValue.faqs.map((item, i) =>
    i === index ? { ...item, ...patch } : item,
  )
  replace({ faqs: next })
}
function addFaq() {
  if (props.modelValue.faqs.length >= MAX_ROWS) return
  replace({ faqs: [...props.modelValue.faqs, { q: '', a: '' }] })
}
function removeFaq(index: number) {
  replace({ faqs: props.modelValue.faqs.filter((_, i) => i !== index) })
}
</script>

<template>
  <div class="space-y-6">
    <section v-for="group in lineGroups" :key="group.key" class="space-y-2">
      <div class="flex flex-wrap items-baseline justify-between gap-x-3">
        <UiLabel class="text-sm font-semibold">{{ group.label }}</UiLabel>
        <span class="text-muted-foreground text-xs">{{ group.hint }}</span>
      </div>
      <div v-for="(line, index) in group.items" :key="index" class="flex items-start gap-2">
        <span class="text-muted-foreground mt-2 w-5 shrink-0 text-xs tabular-nums">
          {{ index + 1 }}
        </span>
        <UiTextarea
          :model-value="line"
          rows="2"
          class="min-h-9 flex-1"
          @update:model-value="(v: string | undefined) => setLine(group.key, index, String(v ?? ''))"
        />
        <UiButton
          variant="ghost"
          size="icon"
          class="mt-0.5 size-8 shrink-0"
          type="button"
          :aria-label="`删除${group.label}第 ${index + 1} 条`"
          @click="removeLine(group.key, index)"
        >
          <Minus class="size-3.5" />
        </UiButton>
      </div>
      <UiButton
        variant="outline"
        size="sm"
        type="button"
        :disabled="group.items.length >= MAX_ROWS"
        @click="addLine(group.key)"
      >
        <Plus class="mr-1 size-3.5" />添加一条
      </UiButton>
    </section>

    <section v-for="group in pairGroups" :key="group.key" class="space-y-2">
      <div class="flex flex-wrap items-baseline justify-between gap-x-3">
        <UiLabel class="text-sm font-semibold">{{ group.label }}</UiLabel>
        <span class="text-muted-foreground text-xs">{{ group.hint }}</span>
      </div>
      <div
        v-for="(item, index) in group.items"
        :key="index"
        class="space-y-2 rounded-lg border border-border/70 p-2.5"
      >
        <div class="flex items-start gap-2">
          <UiInput
            :model-value="item.title"
            placeholder="标题"
            class="flex-1"
            @update:model-value="(v: string | number | undefined) => setPair(group.key, index, { title: String(v ?? '') })"
          />
          <UiButton
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            type="button"
            :aria-label="`删除${group.label}第 ${index + 1} 条`"
            @click="removePair(group.key, index)"
          >
            <Minus class="size-3.5" />
          </UiButton>
        </div>
        <UiTextarea
          :model-value="item.desc"
          rows="2"
          placeholder="说明"
          class="min-h-9"
          @update:model-value="(v: string | undefined) => setPair(group.key, index, { desc: String(v ?? '') })"
        />
      </div>
      <UiButton
        variant="outline"
        size="sm"
        type="button"
        :disabled="group.items.length >= MAX_ROWS"
        @click="addPair(group.key)"
      >
        <Plus class="mr-1 size-3.5" />添加一条
      </UiButton>
    </section>

    <section class="space-y-2">
      <div class="flex flex-wrap items-baseline justify-between gap-x-3">
        <UiLabel class="text-sm font-semibold">常见问题</UiLabel>
        <span class="text-muted-foreground text-xs">页面上是原生折叠块，不靠脚本也能展开。</span>
      </div>
      <div
        v-for="(item, index) in modelValue.faqs"
        :key="index"
        class="space-y-2 rounded-lg border border-border/70 p-2.5"
      >
        <div class="flex items-start gap-2">
          <UiInput
            :model-value="item.q"
            placeholder="问题"
            class="flex-1"
            @update:model-value="(v: string | number | undefined) => setFaq(index, { q: String(v ?? '') })"
          />
          <UiButton
            variant="ghost"
            size="icon"
            class="size-8 shrink-0"
            type="button"
            :aria-label="`删除第 ${index + 1} 个问题`"
            @click="removeFaq(index)"
          >
            <Minus class="size-3.5" />
          </UiButton>
        </div>
        <UiTextarea
          :model-value="item.a"
          rows="3"
          placeholder="回答"
          class="min-h-9"
          @update:model-value="(v: string | undefined) => setFaq(index, { a: String(v ?? '') })"
        />
      </div>
      <UiButton
        variant="outline"
        size="sm"
        type="button"
        :disabled="modelValue.faqs.length >= MAX_ROWS"
        @click="addFaq"
      >
        <Plus class="mr-1 size-3.5" />添加一条
      </UiButton>
    </section>
  </div>
</template>
