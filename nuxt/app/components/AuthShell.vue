<script setup lang="ts">
/**
 * The frame every auth page shares, ported from the `(auth)` route group's
 * repeated markup: a full-height muted backdrop, the brand centred above a
 * card, and nothing else.
 *
 * The source auth pages sit outside `DirectoryLayout` — no sidebar, no footer.
 * Nuxt equivalent: those pages set `layout: false`, so this shell is the whole
 * page. That also means the icon sprite is not mounted by a layout here, which
 * is why `<IconSprite />` is included.
 */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="src-page flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
    <IconSprite />

    <div class="flex w-full max-w-sm flex-col gap-6">
      <NuxtLink to="/" class="self-center">
        <span class="flex items-center gap-2">
          <img src="/assets/img/brand/logo.png" alt="Product Atlas" width="28" height="28">
          <span class="text-lg font-semibold tracking-tight">Product Atlas</span>
        </span>
      </NuxtLink>

      <div class="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <div class="flex flex-col gap-1.5 p-6 text-center">
          <h1 class="text-xl font-semibold leading-none tracking-tight">{{ title }}</h1>
          <p v-if="description" class="text-sm text-muted-foreground">{{ description }}</p>
        </div>
        <div class="p-6 pt-0">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
