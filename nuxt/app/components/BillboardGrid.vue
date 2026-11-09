<script setup lang="ts">
/**
 * Homepage Top 10. Prices come from the Billboard tier table. Empty cells are
 * a dashed claim, not a sample product and not a bid ladder.
 */
import { tierPriceLabel, type BillboardCell, type BillboardRow } from '~~/shared/utils/billboard'

defineProps<{
  cells: BillboardCell<BillboardRow>[]
}>()

const { pick } = useLang()
const localePath = useLocalePath()
const claimTo = computed(() => `${localePath('/billboard')}#claim`)

function priceOf(tier: string): string {
  return tierPriceLabel(tier)
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
            'bb-card--prime': cell.kind === 'live' && cell.placement.tier === 'prime',
          }"
        >
          <template v-if="cell.kind === 'live'">
            <a
              class="bb-shot"
              :href="cell.placement.url"
              target="_blank"
              rel="sponsored nofollow noopener"
            >
              <img
                v-if="cell.placement.screenshot"
                :src="logoSrc(cell.placement.screenshot)"
                alt=""
                loading="lazy"
              >
              <span v-else class="bb-shot__plain">{{ cell.placement.name }}</span>
            </a>
            <div class="bb-foot">
              <span class="bb-logo">
                <ToolLogo :logo="cell.placement.logo" :name="cell.placement.name" :size="28" decorative />
              </span>
              <span class="bb-meta">
                <strong>
                  {{ cell.placement.name }}
                  <em>BILLBOARD</em>
                </strong>
                <span>{{ cell.placement.tagline }}</span>
              </span>
              <span class="bb-price">{{ priceOf(cell.placement.tier) }}</span>
            </div>
          </template>
          <NuxtLink v-else class="bb-empty" :to="claimTo">
            <span class="bb-shot bb-shot--dashed">{{ pick('投放广告', 'Advertise') }}</span>
            <span class="bb-foot">
              <span class="bb-logo bb-logo--empty">+</span>
              <span class="bb-meta">
                <strong>{{ pick('认领这个空位', 'Claim this spot') }}</strong>
                <span>{{ pick('确认收款后才上榜', 'Goes live after payment') }}</span>
              </span>
              <span class="bb-price">Claim</span>
            </span>
          </NuxtLink>
        </article>
      </div>
    </div>
    <p class="bb-note">
      {{
        pick(
          '价签是已确认档位的表价：入门 $15、标准 $29、优先 $49。未确认收款的申请不会出现在这里。',
          'Price tags are the confirmed tier’s list price: Entry $15, Standard $29, Prime $49. An unconfirmed request is not shown.',
        )
      }}
    </p>
  </section>
</template>
