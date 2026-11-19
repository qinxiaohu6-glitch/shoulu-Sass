<script setup lang="ts">
/**
 * The paid-row crown, drawn rather than typed.
 *
 * `♛` renders at whatever weight and colour the local font happens to carry, so
 * it read as a small flat glyph instead of the gold badge the paid tier sells.
 * Three layers do the 3D work: a dark extrusion offset downward, a gradient
 * face with a warm outline, and a white gloss that fades out by mid-height.
 *
 * Gradients are per-instance via `useId()`: several rows wear this crown on one
 * page, and duplicate gradient ids would make every row silently borrow the
 * first instance's colours (and break if that row ever unmounts).
 */
import { useId } from 'vue'

const uid = useId()

/** Crown silhouette: two outer peaks, a taller centre peak, flat band below. */
const BODY = 'M4.6 22 L4.6 9.6 L11.3 15.4 L18 5.6 L24.7 15.4 L31.4 9.6 L31.4 22 Z'
</script>

<template>
  <svg class="paid-crown" viewBox="0 0 36 28" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient :id="`${uid}-face`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFEFB0" />
        <stop offset="34%" stop-color="#FFD24A" />
        <stop offset="70%" stop-color="#F0A81A" />
        <stop offset="100%" stop-color="#D07C00" />
      </linearGradient>
      <linearGradient :id="`${uid}-band`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFE07A" />
        <stop offset="48%" stop-color="#F5AE22" />
        <stop offset="100%" stop-color="#B96A00" />
      </linearGradient>
      <linearGradient :id="`${uid}-gloss`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.72" />
        <stop offset="52%" stop-color="#FFFFFF" stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- Extrusion: the same silhouette pushed down, so the crown has thickness. -->
    <g fill="#9A5400" transform="translate(0 1.7)">
      <path :d="BODY" />
      <circle cx="4.6" cy="8" r="2.4" />
      <circle cx="18" cy="4.2" r="2.6" />
      <circle cx="31.4" cy="8" r="2.4" />
      <rect x="3" y="22" width="30" height="4.4" rx="1.6" />
    </g>

    <!-- Face -->
    <path :d="BODY" :fill="`url(#${uid}-face)`" stroke="#C77A00" stroke-width="0.7" stroke-linejoin="round" />
    <circle cx="4.6" cy="8" r="2.4" :fill="`url(#${uid}-face)`" stroke="#C77A00" stroke-width="0.7" />
    <circle cx="18" cy="4.2" r="2.6" :fill="`url(#${uid}-face)`" stroke="#C77A00" stroke-width="0.7" />
    <circle cx="31.4" cy="8" r="2.4" :fill="`url(#${uid}-face)`" stroke="#C77A00" stroke-width="0.7" />
    <rect x="3" y="22" width="30" height="4.4" rx="1.6" :fill="`url(#${uid}-band)`" stroke="#C77A00" stroke-width="0.7" />

    <!-- Gloss on the upper half only; a full-height sheen flattens it again. -->
    <path :d="BODY" :fill="`url(#${uid}-gloss)`" />
    <circle cx="4.6" cy="7.4" r="1.5" fill="#FFFFFF" opacity="0.55" />
    <circle cx="18" cy="3.6" r="1.6" fill="#FFFFFF" opacity="0.6" />
    <circle cx="31.4" cy="7.4" r="1.5" fill="#FFFFFF" opacity="0.45" />
  </svg>
</template>

<style scoped>
.paid-crown {
  display: block;
  /* 100% of the wrapper, never the intrinsic size: the repo's global
     `img, svg { max-width: 100% }` plus an absolutely-positioned, shrink-to-fit
     wrapper collapsed the crown to 10px wide when it declared 26px itself. */
  width: 100%;
  height: 100%;
  /* Drop shadow belongs to the SVG, not the wrapper: the wrapper is what gets
     positioned over the logo, and a filter there would shadow the logo edge. */
  filter: drop-shadow(0 2px 3px rgba(120, 70, 0, 0.42));
}
</style>
