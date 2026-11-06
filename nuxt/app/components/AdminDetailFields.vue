<script setup lang="ts">
/**
 * Editor for the six long-form sections of one listing, in one language.
 *
 * Rendered twice on the tool page — once per locale — rather than once with a
 * language switch. Copy is translated field by field, and hiding half of it
 * behind a toggle is how a Chinese page ends up with an English FAQ.
 *
 * The two shapes are edited differently on purpose. A step or a pro is one
 * line, so it is one box. A feature is a title *and* an explanation, so it is
 * two. Making every section a free-text blob would save markup and lose the
 * structure the page renders.
 *
 * Everything emits a new object; nothing mutates the prop. The parent keeps
 * one `draft` object and a save either writes all of it or none of it.
 */
import type { DetailBlock, DetailFaq, DetailItem } from '~~/shared/types/catalog'

const props = defineProps<{ modelValue: DetailBlock }>()
const emit = defineEmits<{ 'update:modelValue': [DetailBlock] }>()

const { pick } = useLang()

function replace(patch: Partial<DetailBlock>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

/* --- one-line lists: how to use, pros, cons ------------------------------ */

type LineKey = 'how_to_use' | 'pros' | 'cons'

const LINES = [
  { key: 'how_to_use', zh: '使用步骤', en: 'How to use', hint_zh: '按顺序写，一步一行。', hint_en: 'One step per row, in order.' },
  { key: 'pros', zh: '优点', en: 'Pros', hint_zh: '一句话一条。', hint_en: 'One line each.' },
  { key: 'cons', zh: '缺点', en: 'Cons', hint_zh: '一句话一条，空着就不显示这一栏。', hint_en: 'One line each — an empty column is not rendered.' },
] as const

function setLine(key: LineKey, index: number, value: string) {
  const next = [...props.modelValue[key]]
  next[index] = value
  replace({ [key]: next })
}
function addLine(key: LineKey) {
  replace({ [key]: [...props.modelValue[key], ''] })
}
function removeLine(key: LineKey, index: number) {
  replace({ [key]: props.modelValue[key].filter((_, i) => i !== index) })
}

/* --- title + description lists: features, use cases ---------------------- */

type PairKey = 'features' | 'use_cases'

const PAIRS = [
  { key: 'features', zh: '主要功能', en: 'Features' },
  { key: 'use_cases', zh: '适合谁用', en: 'Use cases' },
] as const

function setPair(key: PairKey, index: number, patch: Partial<DetailItem>) {
  const next = props.modelValue[key].map((item, i) => (i === index ? { ...item, ...patch } : item))
  replace({ [key]: next })
}
function addPair(key: PairKey) {
  replace({ [key]: [...props.modelValue[key], { title: '', desc: '' }] })
}
function removePair(key: PairKey, index: number) {
  replace({ [key]: props.modelValue[key].filter((_, i) => i !== index) })
}

/* --- FAQ ---------------------------------------------------------------- */

function setFaq(index: number, patch: Partial<DetailFaq>) {
  const next = props.modelValue.faqs.map((item, i) => (i === index ? { ...item, ...patch } : item))
  replace({ faqs: next })
}
function addFaq() {
  replace({ faqs: [...props.modelValue.faqs, { q: '', a: '' }] })
}
function removeFaq(index: number) {
  replace({ faqs: props.modelValue.faqs.filter((_, i) => i !== index) })
}
</script>

<template>
  <div class="admin-detail">
    <div v-for="group in LINES" :key="group.key" class="admin-detail__group">
      <div class="admin-detail__head">
        <strong>{{ pick(group.zh, group.en) }}</strong>
        <span>{{ pick(group.hint_zh, group.hint_en) }}</span>
      </div>
      <div v-for="(line, index) in modelValue[group.key]" :key="index" class="admin-detail__row">
        <span class="admin-detail__idx">{{ index + 1 }}</span>
        <textarea
          class="admin-input"
          rows="2"
          :value="line"
          @input="setLine(group.key, index, ($event.target as HTMLTextAreaElement).value)"
        />
        <button class="btn btn--ghost btn--sm" type="button" :title="pick('删除这一条', 'Remove this row')" @click="removeLine(group.key, index)">
          <Icon name="minus" />
        </button>
      </div>
      <button class="btn btn--outline btn--sm" type="button" @click="addLine(group.key)">
        <Icon name="plus" />{{ pick('添加一条', 'Add a row') }}
      </button>
    </div>

    <div v-for="group in PAIRS" :key="group.key" class="admin-detail__group">
      <div class="admin-detail__head">
        <strong>{{ pick(group.zh, group.en) }}</strong>
        <span>{{ pick('标题 + 说明，说明可以不填。', 'A title and an explanation — the explanation is optional.') }}</span>
      </div>
      <div v-for="(item, index) in modelValue[group.key]" :key="index" class="admin-detail__pair">
        <input
          class="admin-input"
          :value="item.title"
          :placeholder="pick('标题', 'Title')"
          @input="setPair(group.key, index, { title: ($event.target as HTMLInputElement).value })"
        >
        <textarea
          class="admin-input"
          rows="2"
          :value="item.desc"
          :placeholder="pick('说明', 'Explanation')"
          @input="setPair(group.key, index, { desc: ($event.target as HTMLTextAreaElement).value })"
        />
        <button class="btn btn--ghost btn--sm" type="button" @click="removePair(group.key, index)">
          <Icon name="minus" />
        </button>
      </div>
      <button class="btn btn--outline btn--sm" type="button" @click="addPair(group.key)">
        <Icon name="plus" />{{ pick('添加一条', 'Add a row') }}
      </button>
    </div>

    <div class="admin-detail__group">
      <div class="admin-detail__head">
        <strong>{{ pick('常见问题', 'FAQ') }}</strong>
        <span>{{ pick('页面上是原生折叠块，不靠脚本也能展开。', 'Rendered as native collapsible blocks — readable without JS.') }}</span>
      </div>
      <div v-for="(item, index) in modelValue.faqs" :key="index" class="admin-detail__pair">
        <input
          class="admin-input"
          :value="item.q"
          :placeholder="pick('问题', 'Question')"
          @input="setFaq(index, { q: ($event.target as HTMLInputElement).value })"
        >
        <textarea
          class="admin-input"
          rows="3"
          :value="item.a"
          :placeholder="pick('回答', 'Answer')"
          @input="setFaq(index, { a: ($event.target as HTMLTextAreaElement).value })"
        />
        <button class="btn btn--ghost btn--sm" type="button" @click="removeFaq(index)">
          <Icon name="minus" />
        </button>
      </div>
      <button class="btn btn--outline btn--sm" type="button" @click="addFaq">
        <Icon name="plus" />{{ pick('添加一条', 'Add a row') }}
      </button>
    </div>
  </div>
</template>
