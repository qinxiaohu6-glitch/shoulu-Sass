<script setup lang="ts">
/**
 * Attachment thumbnails, shared by the reporter's thread and the console.
 *
 * `draft` turns each tile into a remove button; otherwise it is a link that
 * opens in a new tab.
 *
 * A tile whose image fails collapses to a small glyph rather than leaving an
 * empty bordered square. The URLs point at whatever host the reporter used, so
 * a 404, a hotlink block or an expired share link is an ordinary Tuesday — and
 * a row of empty squares reads as a rendering bug in our own page, not as a
 * dead link in theirs.
 */
const props = withDefaults(defineProps<{ urls: string[]; draft?: boolean }>(), {
  draft: false,
})

defineEmits<{ remove: [index: number] }>()

const { pick } = useLang()
const broken = ref<Record<string, boolean>>({})

/** Draft tiles are keyed by URL, so two identical links share one flag. */
function markBroken(url: string) {
  broken.value[url] = true
}
</script>

<template>
  <div v-if="props.urls.length" class="tk-attach" :class="{ 'tk-attach--draft': draft }">
    <template v-for="(url, i) in props.urls" :key="`${url}-${i}`">
      <button
        v-if="draft"
        type="button"
        :title="pick('移除', 'Remove')"
        @click="$emit('remove', i)"
      >
        <img v-if="!broken[url]" :src="url" alt="" loading="lazy" @error="markBroken(url)">
        <span v-else class="tk-attach__broken" aria-hidden="true">!</span>
      </button>
      <a
        v-else
        :href="url"
        target="_blank"
        rel="noopener noreferrer nofollow"
        :title="pick('在新窗口打开', 'Open in a new tab')"
      >
        <img v-if="!broken[url]" :src="url" alt="" loading="lazy" @error="markBroken(url)">
        <span v-else class="tk-attach__broken" aria-hidden="true">!</span>
      </a>
    </template>
  </div>
</template>
