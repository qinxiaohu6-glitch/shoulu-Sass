<script setup lang="ts">
/**
 * One product icon, in whichever form the record happens to have it.
 *
 * Catalogue logos are repo-relative and always present; a submitted listing
 * carries an absolute URL and may carry nothing at all. A missing logo used to
 * render a broken <img>, which reads as "this site is broken" — a monogram is
 * honest about the fact that no icon was supplied.
 */
withDefaults(
  defineProps<{
    logo: string
    name: string
    /** Intrinsic size in px; the CSS box around it sets the rendered size. */
    size: number
    lazy?: boolean
    /** Rails and lists already name the tool next to the icon. */
    decorative?: boolean
  }>(),
  { lazy: false, decorative: false },
)
</script>

<template>
  <img
    v-if="logo"
    :src="logoSrc(logo)"
    :alt="decorative ? '' : `${name} logo`"
    :width="size"
    :height="size"
    :loading="lazy ? 'lazy' : undefined"
  >
  <span
    v-else
    class="tool-logo__initial"
    :style="{ fontSize: `${Math.round(size * 0.42)}px` }"
    aria-hidden="true"
  >{{ name.slice(0, 1).toUpperCase() }}</span>
</template>

<style scoped>
/* Fills whatever `.tool-icon` / `.detail-icon` box it sits in. */
.tool-logo__initial {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-weight: 700;
  line-height: 1;
  color: var(--muted-foreground);
}
</style>
