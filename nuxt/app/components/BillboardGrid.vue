<script setup lang="ts">
/**
 * Homepage Top 10. The price pill is the website's current backing.
 * Empty cells are a dashed claim from the bid floor. No stock screenshot is invented.
 */
import { BILLBOARD_FLOOR_CENTS, backingLabel, faviconForUrl } from '~~/shared/utils/billboard-bid'
import { centsLabel } from '~~/shared/content/campaign'
import { screenshotSrc } from '~~/shared/utils/screenshot'
import type { BillboardCell, BillboardRow } from '~~/shared/utils/billboard'

const props = defineProps<{
  cells: BillboardCell<BillboardRow>[]
  /** placement URL -> our own /products/<slug>, when the site lists it. */
  productSlugs?: Record<string, string>
}>()

const { pick } = useLang()
const localePath = useLocalePath()
const claimTo = computed(() => `${localePath('/billboard')}#claim`)
const floorLabel = centsLabel(BILLBOARD_FLOOR_CENTS)
const brokenShots = ref<Record<string, true>>({})

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

/** Link to our own product page when the paid URL is also a listing, else the site. */
function slugOf(row: BillboardRow): string {
  return props.productSlugs?.[row.url] ?? ''
}
</script>

<template>
  <section class="bb-wrap" aria-labelledby="billboard-top-title" data-billboard-source="api/billboard">
    <div class="billboard">
      <div class="bb-head">
        <p id="billboard-top-title" class="bb-label">TOP 10 ON THE BILLBOARD</p>
        <NuxtLink class="bb-cta" :to="claimTo">
          {{ pick('想要这个位置？', 'Want this spot?') }} →
        </NuxtLink>
      </div>
      <div class="bb-grid">
        <article
          v-for="cell in cells"
          :key="cell.kind === 'live' ? cell.placement.id : `empty-${cell.rank}`"
          class="bb-card"
          :class="{
            'bb-card--empty': cell.kind === 'empty',
            'bb-card--top': cell.kind === 'live' && cell.rank === 1,
          }"
        >
          <template v-if="cell.kind === 'live'">
            <NuxtLink
              v-if="slugOf(cell.placement)"
              class="bb-shot"
              :class="{ 'bb-shot--image': shotOf(cell.placement) }"
              :to="localePath(`/products/${slugOf(cell.placement)}`)"
            >
              <img
                v-if="shotOf(cell.placement)"
                :src="shotOf(cell.placement)"
                :alt="cell.placement.name"
                @error="onShotError(shotOf(cell.placement))"
              >
              <span v-else class="bb-shot__plain">{{ cell.placement.name }}</span>
            </NuxtLink>
            <a
              v-else
              class="bb-shot"
              :class="{ 'bb-shot--image': shotOf(cell.placement) }"
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
              <span v-else class="bb-shot__plain">{{ cell.placement.name }}</span>
            </a>
            <div class="bb-foot">
              <span class="bb-logo">
                <ToolLogo :logo="logoOf(cell.placement)" :name="cell.placement.name" :size="28" decorative />
              </span>
              <span class="bb-meta">
                <NuxtLink v-if="slugOf(cell.placement)" :to="localePath(`/products/${slugOf(cell.placement)}`)">
                  <strong>
                    {{ cell.placement.name }}
                    <em>BILLBOARD</em>
                  </strong>
                </NuxtLink>
                <strong v-else>
                  {{ cell.placement.name }}
                  <em>BILLBOARD</em>
                </strong>
                <span>{{ cell.placement.tagline }}</span>
              </span>
              <span class="bb-price">{{ backingLabel(cell.placement) }}</span>
            </div>
          </template>
          <NuxtLink v-else class="bb-empty" :to="claimTo">
            <span class="bb-shot bb-shot--dashed">{{ pick('空位', 'Open') }}</span>
            <span class="bb-foot">
              <span class="bb-logo bb-logo--empty">+</span>
              <span class="bb-meta">
                <strong>{{ pick('认领这个空位', 'Claim this spot') }}</strong>
                <span>{{ pick(`从 ${floorLabel} 起`, `From ${floorLabel}`) }}</span>
              </span>
              <span class="bb-price">{{ pick(`认领 · ${floorLabel} 起`, `Claim · from ${floorLabel}`) }}</span>
            </span>
          </NuxtLink>
        </article>
      </div>
    </div>
    <p class="bb-note">
      {{
        pick(
          `价签是该网站当前累计金额。新认领从 ${floorLabel} 起。未确认的申请不会出现在这里。`,
          `Price tags are the current backing for that website. New claims start at ${floorLabel}. An unconfirmed request is not shown.`,
        )
      }}
    </p>
  </section>
</template>
