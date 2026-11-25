<script setup lang="ts">
/**
 * The Billboard, as a rail.
 *
 * It used to be a full-width Top 10: ten cells in two rows of five, which cost
 * roughly 500px above the fold and read as a wall of dashed boxes whenever
 * nobody had bought a slot. Five slots now run down the two side rails of the
 * directory, level with the feed they sit beside, so the board adds no page
 * height at all — the rails are already there.
 *
 * A paid slot keeps its screenshot, because "your screenshot on the homepage"
 * is what the buyer pays for. `screenshotSrc` is still the only way a shot
 * reaches the page: a row with no stored screenshot falls back to its logo and
 * never to an invented image.
 */
import { backingLabel, faviconForUrl } from '~~/shared/utils/billboard-bid'
import { BILLBOARD_TOP_N } from '~~/shared/content/billboard'
import { adPriceCents } from '~~/shared/content/pricing'
import { screenshotSrc } from '~~/shared/utils/screenshot'
import type { BillboardCell, BillboardRow } from '~~/shared/utils/billboard'

const props = defineProps<{
  cells: BillboardCell<BillboardRow>[]
  /** placement URL -> our own /products/<slug>, when the site lists it. */
  productSlugs?: Record<string, string>
  /**
   * `left` and `right` are the two rails flanking the feed. `stack` is the
   * phone layout, where both rails dissolve and the five slots have to read as
   * one board instead of being split by the list between them.
   */
  side?: 'left' | 'right' | 'stack'
}>()

const { pick } = useLang()
const localePath = useLocalePath()
const claimTo = computed(() => `${localePath('/book-ad')}?slot=board&weeks=1`)
const boardTo = computed(() => localePath('/billboard'))
const topLabel = `TOP ${BILLBOARD_TOP_N}`
const brokenShots = ref<Record<string, true>>({})
const rootEl = ref<HTMLElement | null>(null)

const isHot = computed(() => props.side === 'right')
const firstOpenRank = computed(() => {
  if (props.side === 'stack') return null
  return props.cells.find((cell) => cell.kind === 'empty')?.rank ?? null
})
const boardWeeklyPrice = computed(() => {
  const cents = adPriceCents('board', 1)
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
})

function flipsOpenSlot(cell: BillboardCell<BillboardRow>): boolean {
  return cell.kind === 'empty' && cell.rank === firstOpenRank.value
}

function shotOf(row: BillboardRow): string {
  const src = screenshotSrc(row.screenshot)
  if (!src || brokenShots.value[src]) return ''
  return src
}

function onShotError(src: string) {
  brokenShots.value = { ...brokenShots.value, [src]: true }
}

function logoOf(row: BillboardRow): string {
  return row.logo || faviconForUrl(row.url)
}

/**
 * A screenshot that 404s *before hydration* never reaches `@error`: the server
 * ships the plain `<img src>`, the browser gives up on it, and Vue only wires
 * the listener afterwards. The slot then keeps the browser's broken-image glyph
 * and paints the alt text in 24px type across the card — the ugliest possible
 * state for a slot somebody paid for.
 *
 * So sweep the rendered images once on mount. `complete && naturalWidth === 0`
 * is exactly "this finished failing", which covers both the pre-hydration miss
 * and a cached 404.
 */
onMounted(() => {
  rootEl.value?.querySelectorAll<HTMLImageElement>('.bb-slot__shot img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) onShotError(img.getAttribute('src') || '')
  })
})

/** Link to our own product page when the paid URL is also a listing, else the site. */
function slugOf(row: BillboardRow): string {
  return props.productSlugs?.[row.url] ?? ''
}
</script>

<template>
  <section ref="rootEl" class="bb-rail" :data-billboard-source="cells.length ? 'api/billboard' : undefined">
    <div class="bb-rail__head">
      <p class="bb-rail__label" :class="{ 'bb-rail__label--hot': isHot }">
        {{ isHot ? pick('想要这个位置？', 'WANT THIS SPOT?') : `BILLBOARD · ${topLabel}` }}
      </p>
      <NuxtLink v-if="isHot" class="bb-rail__cta" :to="boardTo">
        {{ pick('查看榜单', 'See the board') }} →
      </NuxtLink>
      <NuxtLink v-else class="bb-rail__cta" :to="claimTo">
        {{ pick('认领', 'Claim') }} →
      </NuxtLink>
    </div>

    <template v-for="cell in cells" :key="cell.kind === 'live' ? cell.placement.id : `empty-${cell.rank}`">
      <article v-if="cell.kind === 'live'" class="bb-slot bb-slot--live">
        <!--
          The paid mark, not the auction position. A number in the corner only
          means something to someone who is bidding; what a buyer is actually
          paying for is being visibly marked as one. The open slots keep their
          numbers, so the board still reads as a ladder of five.
        -->
        <span
          class="bb-slot__paid"
          :title="pick('赞助广告位', 'Sponsored placement')"
          :aria-label="pick('赞助广告位', 'Sponsored placement')"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2.2 12.6 L2.2 5.4 L5.6 8.6 L8 3.4 L10.4 8.6 L13.8 5.4 L13.8 12.6 Z" fill="currentColor" />
          </svg>
          {{ pick('赞助', 'Sponsored') }}
        </span>

        <NuxtLink
          v-if="slugOf(cell.placement)"
          class="bb-slot__shot"
          :to="localePath(`/products/${slugOf(cell.placement)}`)"
        >
          <img
            v-if="shotOf(cell.placement)"
            :src="shotOf(cell.placement)"
            :alt="cell.placement.name"
            @error="onShotError(shotOf(cell.placement))"
          >
          <span v-else class="bb-slot__shot-plain">
            <ToolLogo :logo="logoOf(cell.placement)" :name="cell.placement.name" :size="40" decorative />
          </span>
        </NuxtLink>
        <a
          v-else
          class="bb-slot__shot"
          :href="cell.placement.url"
          target="_blank"
          rel="sponsored nofollow noopener"
        >
          <img
            v-if="shotOf(cell.placement)"
            :src="shotOf(cell.placement)"
            :alt="cell.placement.name"
            @error="onShotError(shotOf(cell.placement))"
          >
          <span v-else class="bb-slot__shot-plain">
            <ToolLogo :logo="logoOf(cell.placement)" :name="cell.placement.name" :size="40" decorative />
          </span>
        </a>

        <div class="bb-slot__foot">
          <span class="bb-slot__logo">
            <ToolLogo :logo="logoOf(cell.placement)" :name="cell.placement.name" :size="22" decorative />
          </span>
          <span class="bb-slot__body">
            <NuxtLink v-if="slugOf(cell.placement)" class="bb-slot__name" :to="localePath(`/products/${slugOf(cell.placement)}`)">
              {{ cell.placement.name }}
            </NuxtLink>
            <strong v-else class="bb-slot__name">{{ cell.placement.name }}</strong>
            <span v-if="cell.placement.tagline" class="bb-slot__sub">{{ cell.placement.tagline }}</span>
          </span>
          <span class="bb-slot__price" :title="pick('该网站当前累计金额', 'Current backing for this site')">
            {{ backingLabel(cell.placement) }}
          </span>
        </div>
      </article>

      <NuxtLink
        v-else
        class="bb-slot bb-slot--empty"
        :class="{ 'bb-slot--flip': flipsOpenSlot(cell) }"
        :to="claimTo"
        :aria-label="flipsOpenSlot(cell) ? pick(`预订第 ${cell.rank} 位 Billboard 广告位，${boardWeeklyPrice} 每周`, `Book Billboard slot ${cell.rank} for ${boardWeeklyPrice} per week`) : undefined"
      >
        <span v-if="flipsOpenSlot(cell)" class="bb-slot__flip-inner">
          <span class="bb-slot__flip-face bb-slot__flip-front">
            <span class="bb-slot__rank">{{ cell.rank }}</span>
            <span class="bb-slot__shot bb-slot__shot--empty" aria-hidden="true">+</span>
            <span class="bb-slot__body">
              <strong class="bb-slot__name">{{ pick('空位', 'Open spot') }}</strong>
              <span class="bb-slot__sub">{{ pick('按周预订', 'Book a week') }}</span>
            </span>
            <span class="bb-slot__claim">{{ pick('预订 →', 'Book →') }}</span>
          </span>
          <span class="bb-slot__flip-face bb-slot__flip-back" aria-hidden="true">
            <strong class="bb-slot__flip-price">{{ boardWeeklyPrice }}</strong>
            <span class="bb-slot__flip-unit">{{ pick('/ 周', '/ week') }}</span>
            <span class="bb-slot__flip-cta">{{ pick('预订广告位 →', 'Rent this spot →') }}</span>
          </span>
        </span>
        <template v-else>
          <span class="bb-slot__rank">{{ cell.rank }}</span>
          <span class="bb-slot__shot bb-slot__shot--empty" aria-hidden="true">+</span>
          <span class="bb-slot__body">
            <strong class="bb-slot__name">{{ pick('空位', 'Open spot') }}</strong>
            <span class="bb-slot__sub">{{ pick('按周预订', 'Book a week') }}</span>
          </span>
          <span class="bb-slot__claim">{{ pick('预订 →', 'Book →') }}</span>
        </template>
      </NuxtLink>
    </template>
  </section>
</template>
