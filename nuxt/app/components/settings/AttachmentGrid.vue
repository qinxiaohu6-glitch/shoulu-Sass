<script setup lang="ts">
/**
 * Source `routes/settings/-tickets-shared.tsx` → `AttachmentGrid`.
 *
 * Read-only thumbnails inside a thread: each one is a link out, 64px, and the
 * strip disappears entirely when there is nothing attached.
 */
defineProps<{ urls: string[] }>()
</script>

<template>
  <div v-if="urls.length" class="mt-2 flex flex-wrap gap-2">
    <a
      v-for="(url, i) in urls"
      :key="`${url}-${i}`"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
    >
      <img
        :src="url"
        alt=""
        class="size-16 rounded-md border border-border object-cover transition-opacity hover:opacity-80"
      >
    </a>
  </div>
</template>
