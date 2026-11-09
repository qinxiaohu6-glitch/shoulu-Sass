<script setup lang="ts">
/**
 * /advertise — four real placements, each with a drawn preview and a checkout
 * path that already exists. Prices come from effectiveQuote, the same function
 * checkout uses. Written review has no self-serve price in the pricing table,
 * so this page does not invent one.
 */
import { effectiveQuote } from '~~/shared/utils/pricing-effective'

const { pick } = useLang()
const localePath = useLocalePath()

const cards = computed(() => {
  const entry = effectiveQuote('billboard', 'entry')
  const standard = effectiveQuote('billboard', 'standard')
  const prime = effectiveQuote('billboard', 'prime')
  const side = effectiveQuote('sidebar', '1')
  const featured = effectiveQuote('listing', 'featured')
  return [
    {
      id: 'billboard',
      kicker: 'BILLBOARD',
      title: pick('首页 Top 10', 'Homepage Top 10'),
      price: `${entry.priceLabel} / ${standard.priceLabel} / ${prime.priceLabel}`,
      when: pick('付款成功后自动上板', 'Live when payment succeeds'),
      body: pick(
        '固定三档，一次付清。和首页 Top 10 是同一份已付款名单。',
        'Three fixed tiers, one payment. The same paid list as the homepage Top 10.',
      ),
      to: `${localePath('/billboard')}#claim`,
      cta: pick('去付款', 'Pay now'),
      preview: 'billboard' as const,
    },
    {
      id: 'sidebar',
      kicker: 'SIDEBAR',
      title: pick('右栏一周', 'Sidebar for a week'),
      price: `${side.priceLabel}${pick('/周', '/wk')}`,
      when: pick('付款成功后自动排期', 'Scheduled when payment succeeds'),
      body: pick(
        '首页和最新收录页的右栏。按周，同一周不卖两次。',
        'The rail on the homepage and the just-added feed. Weekly, and not sold twice in the same week.',
      ),
      to: `${localePath('/book-ad')}?slot=sidebar&weeks=1`,
      cta: pick('选一周', 'Pick a week'),
      preview: 'sidebar' as const,
    },
    {
      id: 'review',
      kicker: 'REVIEW',
      title: pick('撰稿评测', 'Written review'),
      price: pick('编辑确认后报价', 'Quoted after editorial review'),
      when: pick('邮件交付。未发布可退。', 'Delivered by email. Refunded if it is not published.'),
      body: pick(
        '一篇站内评测。这里没有自助标价，避免写一个结账收不到的数字。',
        'An on-site review. There is no self-serve price here, so this page does not invent a charge.',
      ),
      to: localePath('/guest-post'),
      cta: pick('看说明', 'Read how it works'),
      preview: 'review' as const,
    },
    {
      id: 'featured',
      kicker: 'FEATURED',
      title: pick('精选收录', 'Featured listing'),
      price: featured.priceLabel,
      when: pick('付款成功后自动发布', 'Published when payment succeeds'),
      body: pick(
        '目录和分类页置顶 7 天，加首页精选卡。一次付清，不是订阅。',
        'Pinned on the directory and category for 7 days, plus the homepage card. One payment, not a subscription.',
      ),
      to: `${localePath('/submit')}?plan=featured`,
      cta: pick('提交精选', 'Submit Featured'),
      preview: 'featured' as const,
    },
  ]
})

useSeo({
  title: computed(() => pick('投放 · Product Atlas', 'Advertise · Product Atlas')),
  description: computed(() =>
    pick(
      'Billboard、右栏、评测和精选收录。价格与结账实付相同。不承诺排名或流量。',
      'Billboard, sidebar, a written review and a featured listing. The price matches checkout. No promise of rank or traffic.',
    ),
  ),
})
</script>

<template>
  <div class="container adv">
    <section class="mk-hero mk-hero--compact">
      <p class="mk-eyebrow">{{ pick('买完长什么样', 'What you are buying') }}</p>
      <h1 class="mk-h1">{{ pick('四个位置，各自能结账。', 'Four placements, each with a way to pay.') }}</h1>
      <p class="mk-sub">
        {{ pick('预览是画出来的，不是真实客户。一次付款，安全结账。不承诺排名、流量或权重。', 'The previews are drawn, not a real customer. One-time payment, secure checkout. No promise of rankings, traffic, or authority.') }}
      </p>
    </section>

    <article v-for="card in cards" :key="card.id" class="adv-card">
      <div>
        <p class="adv-kicker">{{ card.kicker }}</p>
        <h2>{{ card.title }}</h2>
        <p class="adv-price">{{ card.price }}</p>
        <p>{{ card.body }}</p>
        <p class="adv-when">{{ card.when }}</p>
        <p class="adv-pay">{{ pick('一次性付款 · 安全结账', 'One-time payment · secure checkout') }}</p>
        <NuxtLink class="btn btn--primary" :to="card.to">{{ card.cta }}</NuxtLink>
      </div>
      <div class="adv-preview" :data-kind="card.preview" aria-hidden="true">
        <div v-if="card.preview === 'billboard'" class="mock mock-board">
          <b>BILLBOARD</b>
          <span>Sample product</span>
          <em>{{ card.price.split(' / ')[0] }}</em>
        </div>
        <div v-else-if="card.preview === 'sidebar'" class="mock mock-side">
          <b>SIDEBAR</b>
          <span>Logo · one line</span>
        </div>
        <div v-else-if="card.preview === 'review'" class="mock mock-review">
          <b>/blog/sample-review</b>
          <span>{{ pick('评测页地址示意', 'A sample review URL') }}</span>
        </div>
        <div v-else class="mock mock-feature">
          <b>FEATURED</b>
          <span>{{ pick('目录置顶卡', 'Pinned directory card') }}</span>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.adv-card {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(220px, 0.9fr);
  gap: 24px;
  margin: 0 0 18px;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--card);
}
.adv-kicker { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; color: #b45309; }
.adv-card h2 { margin: 6px 0; font-size: 26px; letter-spacing: -0.03em; }
.adv-price { margin: 0 0 8px; font-size: 20px; font-weight: 700; }
.adv-when, .adv-pay { color: var(--muted-foreground); font-size: 13px; }
.adv-preview { display: grid; place-items: center; border-radius: 16px; background: #fff7e6; min-height: 160px; }
.mock { width: min(100%, 280px); padding: 16px; border-radius: 14px; background: #111; color: #fff; }
.mock b { display: block; color: #fde68a; font-size: 11px; letter-spacing: 0.08em; }
.mock span { display: block; margin-top: 8px; }
.mock em { font-style: normal; color: #fde68a; }
@media (max-width: 800px) {
  .adv-card { grid-template-columns: 1fr; }
}
</style>
