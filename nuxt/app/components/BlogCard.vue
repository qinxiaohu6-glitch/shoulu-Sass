<script setup lang="ts">
/**
 * Ported from `src/components/blog-card.tsx`.
 *
 * The whole card is the link. Classes are the source's, unchanged — the only
 * adaptation is `<Icon name="calendar">` instead of a `lucide-react` import.
 */
const props = defineProps<{
  to: string
  title: string
  description?: string
  image?: string
  date?: string
  authorName?: string
  authorImage?: string
  /** Small label above the title, e.g. "Sponsored". */
  badge?: string
}>()

const localePath = useLocalePath()
</script>

<template>
  <NuxtLink
    :to="localePath(props.to)"
    class="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-foreground/20 hover:shadow-sm"
  >
    <img
      v-if="image"
      :src="image"
      :alt="title"
      width="640"
      height="360"
      loading="lazy"
      class="aspect-video w-full object-cover object-center"
    >
    <div class="flex flex-1 flex-col gap-3 p-6">
      <span
        v-if="badge"
        class="w-fit rounded-full border border-border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase text-muted-foreground"
      >
        {{ badge }}
      </span>
      <h3 class="font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
        {{ title }}
      </h3>
      <p v-if="description" class="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {{ description }}
      </p>
      <div class="mt-auto flex items-center gap-2 pt-2 text-xs text-muted-foreground">
        <span v-if="date" class="inline-flex items-center gap-1.5">
          <Icon name="calendar" :size="14" />
          {{ date }}
        </span>
        <span class="flex-1" />
        <span v-if="authorName || authorImage" class="inline-flex items-center gap-2">
          <img
            v-if="authorImage"
            :src="authorImage"
            :alt="authorName || ''"
            width="20"
            height="20"
            loading="lazy"
            class="size-5 rounded-full object-cover"
          >
          {{ authorName }}
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
