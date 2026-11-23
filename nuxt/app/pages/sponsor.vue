<script setup lang="ts">
/**
 * /sponsor — the two weekly ads checkout actually charges.
 *
 *   - Launch board ad: one banner under the top 3, one brand per week.
 *   - Right sidebar: a card on the homepage and the just-added feed.
 *
 * Prices come from the same helpers as checkout. The board ad is not
 * discounted. The sidebar follows the campaign clock.
 */
import { effectiveQuote } from '~~/shared/utils/pricing-effective'
import { centsLabel } from '~~/shared/content/campaign'
import { adPriceCents } from '~~/shared/content/pricing'
import { EMPTY_AD_AVAILABILITY, openAdWeeks, type AdAvailability } from '~/composables/useAds'

const { pick } = useLang()
const localePath = useLocalePath()
const requestFetch = useRequestFetch()

const boardLabel = centsLabel(adPriceCents('board', 1))
const sidebar = effectiveQuote('sidebar', '1')

const { data: availability } = await useAsyncData<AdAvailability>(
  'sponsor-sidebar-availability',
  async () => {
    try {
      const res = await requestFetch<AdAvailability>('/api/ads/availability?slot=sidebar&weeks=1')
      return {
        ok: Boolean(res?.ok),
        starts: res?.starts ?? [],
        available: res?.available ?? {},
      }
    } catch {
      return EMPTY_AD_AVAILABILITY
    }
  },
  { default: () => EMPTY_AD_AVAILABILITY },
)
const openWeeks = computed(() => openAdWeeks(availability.value))

const checks = computed(() => [
  pick('两个位置都按周租，周一起算', 'Both spots are rented by the week, starting Monday'),
  pick('付款成功后自动上线或排期', 'Live or scheduled when payment succeeds'),
  pick('不自动续费', 'Nothing renews automatically'),
])

const spots = computed(() => [
  {
    id: 'board',
    kicker: pick('每周一个品牌', 'One brand a week'),
    title: pick('发布榜广告', 'Launch board ad'),
    place: pick('发布榜前三名下面', 'Under the top 3 on the launch board'),
    pitch: pick(
      '一条赞助横幅，logo、名称、一句话和按钮。每周只卖给一个品牌，周一到周日。',
      'One sponsored banner with your logo, name, one line, and a button. One brand per week, Monday to Sunday.',
    ),
    price: `${boardLabel}${pick('/周', '/ week')}`,
    availability: pick('每周一个品牌', 'One brand per week'),
    to: `${localePath('/book-ad')}?slot=board&weeks=1`,
    cta: pick('预订一周', 'Book a week'),
  },
  {
    id: 'sidebar',
    kicker: pick('每周固定', 'Weekly'),
    title: pick('右栏广告', 'Right sidebar ad'),
    place: pick('首页右栏，小屏时移到榜单下方', 'Homepage sidebar, under the board on smaller screens'),
    pitch: pick(
      '首页右栏的一张卡片，每个品牌一个位置。同一周不卖两次。',
      'A card in the homepage sidebar. Each brand gets its own slot, and a week is not sold twice.',
    ),
    price: `${sidebar.priceLabel}${pick('/周', '/ week')}`,
    availability: `${openWeeks.value.length} ${pick('周可订', 'weeks open')}`,
    to: `${localePath('/book-ad')}?slot=sidebar&weeks=1`,
    cta: pick('选择右栏', 'Choose Sidebar'),
  },
])

useSeo({
  title: computed(() => pick('投放赞助 · dirtool', 'Advertise to indie makers · dirtool')),
  description: computed(() =>
    pick(
      '把你的产品放到开发者、创始人和早期用户面前。选位置、选周次，一次付清。',
      'Put your product in front of founders, makers and early adopters. Pick a spot, pick a week, pay once.',
    ),
  ),
})
</script>

<template>
  <div class="container sponsor-page">
    <header class="sponsor-head">
      <p class="sponsor-kicker">{{ pick('广告位', 'ADVERTISE') }}</p>
      <h1>{{ pick('投放广告', 'Advertise') }}</h1>
      <p class="sponsor-lead">
        {{
          pick(
            '把你的产品放到创始人、开发者和早期用户面前。选位置、选周次，一次付清。',
            'Put your product in front of founders, makers and early adopters. Pick a spot, pick a week, pay once.',
          )
        }}
      </p>
      <ul class="sponsor-checks">
        <li v-for="check in checks" :key="check"><Icon name="check" :size="16" /> {{ check }}</li>
      </ul>
    </header>

    <div class="sponsor-grid">
      <article v-for="spot in spots" :key="spot.id" class="sponsor-card">
        <span class="sponsor-card__kicker">{{ spot.kicker }}</span>
        <h2>{{ spot.title }}</h2>
        <p class="sponsor-card__place">{{ spot.place }}</p>
        <p class="sponsor-card__pitch">{{ spot.pitch }}</p>
        <div class="sponsor-card__foot">
          <p class="sponsor-card__price">{{ spot.price }}</p>
          <p class="sponsor-card__avail">{{ spot.availability }}</p>
          <NuxtLink class="btn btn--primary btn--block" :to="spot.to">{{ spot.cta }}</NuxtLink>
        </div>
      </article>
    </div>

    <p class="sponsor-note">
      {{
        pick(
          '价格以结账页实付为准。不承诺排名、流量或域名权重。两个广告位都按周租；收录方案另计。已经付款的 Billboard 仍留在 Billboard 页。',
          'The price at checkout is what you pay. No promise of rank, traffic or domain authority. Both ads are weekly. Listing plans are separate. A Billboard placement already paid for stays on the Billboard page.',
        )
      }}
    </p>
  </div>
</template>

<style scoped>
.sponsor-page { padding-top: 28px; padding-bottom: 60px; }
.sponsor-head { max-width: 720px; margin-bottom: 32px; }
.sponsor-kicker { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; color: #b45309; }
.sponsor-head h1 { margin: 8px 0 12px; font-size: 34px; letter-spacing: -0.03em; }
.sponsor-lead { margin: 0; font-size: 17px; line-height: 1.6; color: var(--foreground); }
.sponsor-checks { list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 20px; }
.sponsor-checks li { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted-foreground); }
.sponsor-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
.sponsor-card { display: flex; flex-direction: column; padding: 24px; border: 1px solid var(--border); border-radius: 18px; background: var(--card); }
.sponsor-card__kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; color: #b45309; }
.sponsor-card h2 { margin: 8px 0 4px; font-size: 24px; letter-spacing: -0.02em; }
.sponsor-card__place { margin: 0; font-size: 13px; font-weight: 600; color: var(--foreground); }
.sponsor-card__pitch { margin: 12px 0 0; font-size: 14px; line-height: 1.65; color: var(--muted-foreground); }
.sponsor-card__foot { margin-top: auto; padding-top: 22px; }
.sponsor-card__price { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
.sponsor-card__avail { margin: 4px 0 16px; font-size: 12px; color: var(--muted-foreground); }
.sponsor-note { margin-top: 24px; font-size: 12px; line-height: 1.6; color: var(--muted-foreground); }
@media (max-width: 640px) { .sponsor-head h1 { font-size: 28px; } }
</style>
