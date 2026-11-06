<script setup lang="ts">
/**
 * Ported from `src/components/markdown-content.tsx`.
 *
 * `markdownStyles` is copied class-for-class: it is the typography contract for
 * article bodies, and the admin rich-text editor is supposed to render through
 * the same list so that what you edit matches what the public page shows.
 *
 * The HTML itself comes from `renderMarkdown` in `shared/utils/markdown.ts`,
 * which already escaped raw HTML and set `rel`/`target`/`utm` on links — so the
 * markup here is trusted only in the sense that it was produced by our own
 * renderer, never from a user string.
 */
import { MARKDOWN_STYLES } from '~/utils/markdown-styles'

const props = withDefaults(
  defineProps<{
    content: string
    class?: string
    /** Paid content: external links get `rel="sponsored"`. */
    sponsored?: boolean
    /** Tag external links with utm_source/utm_medium (unless already tagged). */
    utm?: { source: string; medium: string }
  }>(),
  { class: '', sponsored: false, utm: undefined },
)

/**
 * Shared typography for rendered markdown — see `utils/markdown-styles.ts`.
 * The admin rich-text editor renders through the same list.
 */

const html = computed(() =>
  renderMarkdown(props.content, { sponsored: props.sponsored, utm: props.utm }),
)
</script>

<template>
  <div :class="[MARKDOWN_STYLES, props.class]" v-html="html" />
</template>
