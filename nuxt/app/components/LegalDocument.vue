<script setup lang="ts">
import type { LegalDoc } from '~~/shared/content/legal'

const props = defineProps<{ doc: LegalDoc }>()

const { isZh, pick } = useLang()
const localePath = useLocalePath()

type ParaPart = { text: string; href?: string }

/**
 * Waffo's form only accepts two URLs — terms and privacy — so the AUP,
 * moderation, reporting and enforcement sections have to be reachable from
 * *inside* those two pages. The copy cites them as absolute URLs; turning them
 * into real links (and routing through localePath) means a /zh reader stays on
 * /zh instead of being dropped onto the English page. Emails become mailto:.
 * No new UI blocks: the paragraphs keep the live site's one-line-per-bullet
 * rhythm, only the cited text becomes clickable.
 */
const LINK_RE = /(https?:\/\/[^\s<>"'，。；、）)】,;]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g
const SITE_ORIGIN = 'https://dirtool.com'

function localHref(raw: string): string {
  if (!raw.startsWith('http')) return `mailto:${raw}`
  const rest = raw.startsWith(SITE_ORIGIN) ? raw.slice(SITE_ORIGIN.length) : raw
  const [path, hash] = rest.split('#')
  const base = String(localePath(path || '/'))
  return hash ? `${base}#${hash}` : base
}

function parts(text: string): ParaPart[] {
  const out: ParaPart[] = []
  let cursor = 0
  for (const match of text.matchAll(LINK_RE)) {
    const at = match.index ?? 0
    if (at > cursor) out.push({ text: text.slice(cursor, at) })
    const raw = match[0].replace(/[.,;:!?]+$/, '')
    out.push({ text: raw, href: localHref(raw) })
    cursor = at + raw.length
    if (match[0].length > raw.length) out.push({ text: match[0].slice(raw.length) })
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) })
  return out.length ? out : [{ text }]
}

/**
 * The live pages render each bullet as its own paragraph rather than a <ul>,
 * and the section wrapper carries the 8px/24px rhythm inline. Keeping both so
 * the legal pages line up with the rest of the restored type scale.
 */
const sections = computed(() =>
  props.doc.sections.map((section) => ({
    /** Stable anchors: AUP, reporting and enforcement are addressable in-page. */
    id: section.id,
    heading: section.heading[isZh.value ? 'zh' : 'en'],
    paragraphs: (section.bullets?.[isZh.value ? 'zh' : 'en']
      ?? (section.body ? [section.body[isZh.value ? 'zh' : 'en']] : []))
      .map(parts),
  })),
)
</script>

<template>
  <div class="container">
    <div class="article">
      <NuxtLink :to="localePath('/')" class="back-link">
        <Icon name="arrow-left" />
        {{ pick('返回首页', 'Back to home') }}
      </NuxtLink>

      <h1 class="page-title">{{ doc.title[isZh ? 'zh' : 'en'] }}</h1>
      <p class="page-sub">{{ doc.lead[isZh ? 'zh' : 'en'] }}</p>
      <p class="stat-line" style="margin-top: 12px">
        {{ pick('最后更新', 'Last updated') }}：{{ doc.updated }}
      </p>

      <div style="margin-top: 8px">
        <section
          v-for="section in sections"
          :id="section.id"
          :key="section.heading"
          class="doc-section"
          style="padding-top: 24px"
        >
          <h2>{{ section.heading }}</h2>
          <p v-for="(para, i) in section.paragraphs" :key="i">
            <template v-for="(part, j) in para" :key="j">
              <a v-if="part.href" :href="part.href">{{ part.text }}</a>
              <template v-else>{{ part.text }}</template>
            </template>
          </p>
        </section>
      </div>
    </div>
  </div>
</template>
