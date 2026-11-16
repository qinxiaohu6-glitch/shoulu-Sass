<script setup lang="ts">
import { ASK_PROMPT, LLMS_URL, askAssistantHref } from '~~/shared/utils/batch2'

const { pick } = useLang()
const url = useRequestURL()
const pageUrl = computed(() => url.href)

const links = computed(() => [
  { name: 'ChatGPT', href: askAssistantHref('chatgpt', pageUrl.value) },
  { name: 'Claude', href: askAssistantHref('claude', pageUrl.value) },
  { name: 'Perplexity', href: askAssistantHref('perplexity', pageUrl.value) },
  { name: 'Grok', href: askAssistantHref('grok', pageUrl.value) },
])
</script>

<template>
  <nav class="ask-assistants" :aria-label="pick('让助手阅读本页', 'Ask an assistant about this page')">
    <p>{{ pick('让助手只概括本页写明的内容。', 'Ask an assistant to summarize only what this page states.') }}</p>
    <ul>
      <li v-for="link in links" :key="link.name">
        <a :href="link.href" rel="nofollow noopener" target="_blank">Ask {{ link.name }}</a>
      </li>
      <li>
        <a :href="LLMS_URL">llms.txt</a>
      </li>
    </ul>
    <p class="sr-only">{{ ASK_PROMPT }}</p>
  </nav>
</template>

<style scoped>
.ask-assistants {
  margin-top: 14px;
  font-size: 13px;
  line-height: 1.5;
}
.ask-assistants ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}
.ask-assistants a {
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
