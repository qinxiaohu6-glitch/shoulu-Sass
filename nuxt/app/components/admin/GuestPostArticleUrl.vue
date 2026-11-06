<script setup lang="ts">
/**
 * Source `routes/settings/guest-posts/-shared.tsx` — `ArticleUrl`.
 *
 * The article URL; opens it (a preview until published) in a new tab.
 */
const props = defineProps<{ slug: string | null; status: string }>()

const path = computed(() => (props.slug ? `/blog/${props.slug}` : ''))
const href = computed(() =>
  props.slug ? (props.status === 'published' ? path.value : `${path.value}?preview=1`) : '',
)
</script>

<template>
  <a
    v-if="props.slug"
    :href="href"
    target="_blank"
    rel="noopener"
    class="text-muted-foreground hover:text-foreground block max-w-[320px] truncate font-mono text-xs hover:underline"
  >
    {{ path }}
  </a>
</template>
