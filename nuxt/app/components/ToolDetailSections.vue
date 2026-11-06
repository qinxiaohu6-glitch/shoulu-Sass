<script setup lang="ts">
/**
 * The editorial half of a tool detail page.
 *
 * Five sections, each rendered only when it has content — a listing nobody has
 * written copy for shows none of them, which is why every array defaults to
 * empty upstream. The section ids are the anchors `DetailSectionNav` observes;
 * renaming one without renaming it there silently breaks the highlight.
 *
 * The FAQ uses native `<details>` rather than a scripted accordion: it works
 * without JavaScript, it is keyboard-accessible for free, and it survives the
 * crawler that renders the page with scripting disabled.
 */
import type { DetailBlock } from '~~/shared/types/catalog'

defineProps<{
  name: string
  detail: DetailBlock
}>()

const { pick } = useLang()
</script>

<template>
  <div>
    <section v-if="detail.how_to_use.length" id="how-to-use" class="doc-section">
      <h2>{{ pick(`如何使用 ${name}`, `How to use ${name}`) }}</h2>
      <ol class="steps">
        <li v-for="(step, i) in detail.how_to_use" :key="i">{{ step }}</li>
      </ol>
    </section>

    <section v-if="detail.features.length" id="features" class="doc-section">
      <h2>{{ pick(`${name} 的主要功能`, `Key features of ${name}`) }}</h2>
      <ul class="feature-list">
        <li v-for="(item, i) in detail.features" :key="i">
          <span aria-hidden="true">{{ i + 1 }}</span>
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="detail.use_cases.length" id="use-cases" class="doc-section">
      <h2>{{ pick(`${name} 适合谁用`, `What ${name} is used for`) }}</h2>
      <ul class="feature-list">
        <li v-for="(item, i) in detail.use_cases" :key="i">
          <span aria-hidden="true">{{ i + 1 }}</span>
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
          </div>
        </li>
      </ul>
    </section>

    <section
      v-if="detail.pros.length || detail.cons.length"
      id="pros-cons"
      class="doc-section"
    >
      <h2>{{ pick(`${name} 的优点与不足`, `${name}: pros and cons`) }}</h2>
      <div class="pros-cons">
        <div class="pc-card pc-card--pro">
          <p>{{ pick('优点', 'Pros') }}</p>
          <ul>
            <li v-for="(item, i) in detail.pros" :key="i">
              <Icon name="check" />
              <span>{{ item }}</span>
            </li>
          </ul>
        </div>
        <div class="pc-card pc-card--con">
          <p>{{ pick('不足', 'Cons') }}</p>
          <ul>
            <li v-for="(item, i) in detail.cons" :key="i">
              <Icon name="minus" />
              <span>{{ item }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section v-if="detail.faqs.length" id="faq" class="doc-section">
      <h2>{{ pick(`关于 ${name} 的常见问题`, `${name}: frequently asked questions`) }}</h2>
      <div class="faq-list">
        <details v-for="(item, i) in detail.faqs" :key="i" class="faq-item">
          <summary>{{ item.q }}</summary>
          <div class="faq-item__body"><p>{{ item.a }}</p></div>
        </details>
      </div>
    </section>
  </div>
</template>
