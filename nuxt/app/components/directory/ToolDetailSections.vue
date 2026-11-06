<script setup lang="ts">
/**
 * Ported from `shipany-dir/src/components/directory/ToolDetailSections.tsx`.
 *
 * The six long-form sections, each rendered only when it has content: overview,
 * how to use, key features, use cases, pros & cons, FAQ accordion.
 *
 * Data mapping — the source's `ToolDetailTool` against this build's `DetailBlock`:
 *
 *   source          this build
 *   ─────────────   ──────────────────────────────
 *   `introduction`  `tool.long`
 *   `howToUse`      `detail.how_to_use`, already an array of steps
 *   `features`      `detail.features`, `{ title, description }` → `{ title, desc }`
 *   `useCases`      `detail.use_cases`, same shape
 *   `pros`/`cons`   `detail.pros` / `detail.cons`
 *   `faqs`          `detail.faqs`, `{ question, answer }` → `{ q, a }`
 *
 * The source parses a `"1. …\n2. …"` string into steps; here the steps are
 * already split, so the same `<ol>` renders from the array.
 */
import type { DetailFaq, DetailItem } from '~~/shared/types/catalog'

const props = defineProps<{
  toolName: string
  overview?: string
  howToUse: string[]
  features: DetailItem[]
  useCases: DetailItem[]
  pros: string[]
  cons: string[]
  faqs: DetailFaq[]
}>()

const openFaq = defineModel<number | null>('openFaq', { default: null })

const t = useDirectoryCopy()

const steps = computed(() =>
  props.howToUse
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[.)]\s*/, '')),
)

function toggleFaq(index: number) {
  openFaq.value = openFaq.value === index ? null : index
}
</script>

<template>
  <div class="space-y-12">
    <section v-if="overview" id="what-is" class="directory-detail-section">
      <h2 class="mb-4 text-xl font-semibold tracking-tight">
        {{ t('directory.detail.what_is', { name: toolName }) }}
      </h2>
      <div class="text-[15px] leading-7 whitespace-pre-line text-foreground/90">
        <p>{{ overview }}</p>
      </div>
    </section>

    <section v-if="steps.length" id="how-to-use" class="directory-detail-section">
      <h2 class="mb-4 text-xl font-semibold tracking-tight">
        {{ t('directory.detail.how_to_use_title', { name: toolName }) }}
      </h2>
      <div class="text-[15px] leading-7 text-foreground/90">
        <ol class="ml-6 list-decimal space-y-1.5 marker:text-muted-foreground">
          <li v-for="(step, index) in steps" :key="index" class="leading-7">{{ step }}</li>
        </ol>
      </div>
    </section>

    <section v-if="features.length" id="features" class="directory-detail-section">
      <h2 class="mb-4 text-xl font-semibold tracking-tight">
        {{ t('directory.detail.key_features', { name: toolName }) }}
      </h2>
      <ul class="grid gap-3 sm:grid-cols-2">
        <li
          v-for="(item, index) in features"
          :key="index"
          class="flex gap-3 rounded-xl border border-border bg-card p-4"
        >
          <span
            class="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary"
          >
            {{ index + 1 }}
          </span>
          <div class="min-w-0">
            <h3 class="text-[15px] leading-snug font-semibold">{{ item.title }}</h3>
            <p class="mt-1 text-sm leading-relaxed text-muted-foreground">{{ item.desc }}</p>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="useCases.length" id="use-cases" class="directory-detail-section">
      <h2 class="mb-4 text-xl font-semibold tracking-tight">
        {{ t('directory.detail.use_cases_title', { name: toolName }) }}
      </h2>
      <ul class="grid gap-3 sm:grid-cols-2">
        <li
          v-for="(item, index) in useCases"
          :key="index"
          class="flex gap-3 rounded-xl border border-border bg-card p-4"
        >
          <span
            class="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary"
          >
            {{ index + 1 }}
          </span>
          <div class="min-w-0">
            <h3 class="text-[15px] leading-snug font-semibold">{{ item.title }}</h3>
            <p class="mt-1 text-sm leading-relaxed text-muted-foreground">{{ item.desc }}</p>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="pros.length || cons.length" id="pros-cons" class="directory-detail-section">
      <h2 class="mb-4 text-xl font-semibold tracking-tight">
        {{ t('directory.detail.pros_cons_title', { name: toolName }) }}
      </h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl border border-border bg-card p-4">
          <p class="mb-3 text-sm font-semibold">{{ t('directory.pros') }}</p>
          <ul class="space-y-2.5">
            <li
              v-for="(item, index) in pros"
              :key="index"
              class="flex gap-2.5 text-sm leading-relaxed"
            >
              <span
                class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/12 text-emerald-600"
              >
                <Icon name="check" :size="14" />
              </span>
              <span>{{ item }}</span>
            </li>
          </ul>
        </div>

        <div class="rounded-xl border border-border bg-card p-4">
          <p class="mb-3 text-sm font-semibold">{{ t('directory.cons') }}</p>
          <ul class="space-y-2.5">
            <li
              v-for="(item, index) in cons"
              :key="index"
              class="flex gap-2.5 text-sm leading-relaxed"
            >
              <span
                class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-rose-500/12 text-rose-600"
              >
                <Icon name="minus" :size="14" />
              </span>
              <span>{{ item }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section v-if="faqs.length" id="faq" class="directory-detail-section">
      <h2 class="mb-4 text-xl font-semibold tracking-tight">
        {{ t('directory.detail.faq_title', { name: toolName }) }}
      </h2>
      <div class="flex w-full flex-col border-t border-border">
        <div v-for="(faq, index) in faqs" :key="index" class="border-b border-border transition-colors">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between py-4 text-left text-[15px] font-medium transition hover:text-primary"
            @click="toggleFaq(index)"
          >
            <span>{{ faq.q }}</span>
            <Icon
              name="chevron-down"
              :size="16"
              class="text-muted-foreground transition-transform duration-200"
              :class="openFaq === index ? 'rotate-180' : ''"
            />
          </button>
          <div
            v-if="openFaq === index"
            class="animate-in fade-in pb-4 text-sm leading-relaxed whitespace-pre-line text-muted-foreground duration-150"
          >
            {{ faq.a }}
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
