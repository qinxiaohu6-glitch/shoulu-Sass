<script setup lang="ts">
/**
 * Renders a sprite symbol from <IconSprite />.
 *
 * The live site inlines a 24×24 sprite at the top of every page and references
 * it with `<svg class="ic"><use href="#i-…"/></svg>`. Copying that sprite and
 * this one wrapper means every glyph is literally the same path data as the
 * original — no icon library to re-draw them approximately.
 */
defineProps<{
  name: string
  /** Optional px override; otherwise the parent rule (e.g. `.nav-item svg`) sizes it. */
  size?: number
  /**
   * Some glyphs are drawn heavier than the `.ic` default of 1.75 — the
   * pagination chevrons, for instance, are 2 in the original markup. Set inline
   * rather than via an attribute, since a CSS class rule would win over a
   * presentation attribute.
   */
  strokeWidth?: number
}>()
</script>

<template>
  <svg
    class="ic"
    aria-hidden="true"
    :style="{
      ...(size ? { width: `${size}px`, height: `${size}px` } : {}),
      ...(strokeWidth ? { strokeWidth: `${strokeWidth}px` } : {}),
    }"
  >
    <use :href="`#i-${name}`" />
  </svg>
</template>
