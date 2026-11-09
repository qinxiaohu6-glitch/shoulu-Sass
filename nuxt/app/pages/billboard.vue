<script setup lang="ts">
/**
 * /billboard — fixed tiers and the same ranking as the homepage Top 10.
 * Checkout charges `effectiveAmountCents` on the server. This page never sends an amount.
 */
import {
  BILLBOARD_TIERS,
  campaignActive,
  campaignDeadlineShanghai,
  type BillboardTierId,
} from '~~/shared/content/billboard'
import { tierPriceLabel } from '~~/shared/utils/billboard'
import { effectiveQuote } from '~~/shared/utils/pricing-effective'

const { pick, isZh } = useLang()
const localePath = useLocalePath()
const { ranked } = await useBillboard()

const picked = ref<BillboardTierId>('standard')
const url = ref('')
const email = ref('')
const name = ref('')
const busy = ref(false)
const done = ref('')
const error = ref('')
const payable = ref('')

const deadline = campaignDeadlineShanghai()
const promoOn = computed(() => campaignActive())

function tierQuote(id: BillboardTierId) {
  return effectiveQuote('billboard', id, Date.now())
}

const rules = computed(() => [
  {
    n: '1',
    title: pick('固定三档，一次付清', 'Three fixed tiers, one payment'),
    body: pick(
      '入门 $15、标准 $29、优先 $49。标准档替代原来的榜单周租。不是出价，也不是订阅。',
      'Entry $15, Standard $29, Prime $49. Standard replaces the old weekly board rental. Not a bid, and not a subscription.',
    ),
  },
  {
    n: '2',
    title: pick('确认收款后才上榜', 'Live only after payment is confirmed'),
    body: pick(
      '付款成功后，同一条记录会出现在本页和首页 Top 10。未付款不会公开。违规内容可以事后下架。',
      'After payment succeeds, the same record shows here and in the homepage Top 10. Unpaid checkouts stay private. A placement that breaks the rules can be taken down afterward.',
    ),
  },
  {
    n: '3',
    title: pick('档位优先，同档先确认的在前', 'Tier first, then whoever was confirmed earlier'),
    body: pick(
      '优先档排在标准档前，标准档排在入门档前。同一档里，先确认收款的排得更前。这不改变每周投票榜的名次。',
      'Prime sorts above Standard, Standard above Entry. Inside a tier, the earlier confirmed payment is higher. None of this changes rank on the weekly vote board.',
    ),
  },
])

const faq = computed(() =>
  isZh.value
    ? [
        {
          q: '我买到的是什么？',
          a: '站内 Billboard 展示，以及排进前 10 时出现在首页同一块板上。卖的是这个位置，不承诺搜索排名或流量。',
        },
        {
          q: '是订阅吗？',
          a: '不是。三档都是一次性。右栏广告仍按周租，收录档（免费 / $19 / $39 / $69）也是一次性，和 Billboard 分开。',
        },
        {
          q: '多久能上榜？',
          a: '付款成功后自动上板，并同步到首页 Top 10。未付款不会公开。我们保留对违规内容的下架权。',
        },
        {
          q: '免费收录还在吗？',
          a: '在。免费收录走目录和每周投票榜，不占用 Billboard。付费展示会标明 BILLBOARD 或 FEATURED，和票数榜分开。',
        },
      ]
    : [
        {
          q: 'What am I buying?',
          a: 'An on-site Billboard placement, and a cell in the homepage Top 10 while it ranks there. That is a placement on this site. It is not a promise about search rank or traffic.',
        },
        {
          q: 'Is it a subscription?',
          a: 'No. All three tiers are one-time. The sidebar ad is still weekly. Listing tiers (free / $19 / $39 / $69) stay one-time and separate from Billboard.',
        },
        {
          q: 'How soon does it go live?',
          a: 'It goes live when payment succeeds, on this page and in the homepage Top 10. An unpaid checkout is not published. We can take a placement down afterward if it breaks the rules.',
        },
        {
          q: 'Does a free listing still exist?',
          a: 'Yes. A free listing stays in the directory and on the weekly vote board. It does not take a Billboard cell. Paid placements are marked BILLBOARD or FEATURED, apart from the vote list.',
        },
      ],
)

const openFaq = ref(-1)

async function startCheckout() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  const quote = tierQuote(picked.value)
  payable.value = quote.priceLabel
  try {
    const res = await $fetch<{ ok: boolean; url?: string; amount_cents: number; published: boolean }>(
      '/api/billboard/checkout',
      {
        method: 'POST',
        body: { tier: picked.value, url: url.value, email: email.value, name: name.value },
      },
    )
    if (!res?.ok || res.published || res.amount_cents !== quote.amountCents || !res.url) {
      throw new Error('unexpected')
    }
    window.location.assign(res.url)
  } catch (err) {
    const info = (err as { data?: { message_zh?: string; message_en?: string } })?.data
    error.value =
      (isZh.value ? info?.message_zh : info?.message_en) ||
      pick('结账没有打开，请稍后再试。', 'Checkout did not open. Try again in a moment.')
    done.value = payable.value
  } finally {
    busy.value = false
  }
}

useSeo({
  title: computed(() => pick('Billboard · Product Atlas', 'Billboard · Product Atlas')),
  description: computed(() =>
    pick(
      'Billboard 一次性三档。价格与结账实付相同。与首页 Top 10 同一排行。未付款不上板。',
      'Billboard is one-time. The price on this page is the checkout charge. Same ranking as the homepage Top 10. Unpaid rows stay off the board.',
    ),
  ),
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.value.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        }),
      ),
    },
  ],
})
</script>

<template>
  <div class="bb-page">
    <div class="bb-page__hero">
      <div>
        <p class="bb-page__from">
          {{ pick('固定档 · 从 $15 起', 'Fixed tiers · from $15') }}
        </p>
        <h1>Billboard</h1>
        <p class="bb-page__tag">
          {{ pick('一次付款，占一个标明的位置。', 'One payment. One labeled placement.') }}
        </p>
        <p class="bb-page__desc">
          {{
            pick(
              '首页 Top 10 和这一页读的是同一份已确认名单。档位高的在前，同一档先确认的在前。',
              'The homepage Top 10 and this page read the same confirmed list. Higher tiers come first; inside a tier, the earlier confirmation comes first.',
            )
          }}
        </p>

        <form id="claim" class="bb-claim" @submit.prevent="startCheckout">
          <div class="bb-claim__head">
            <h2>{{ pick('认领一个位置', 'Claim a spot') }}</h2>
            <span>{{ payable ? pick(`应付 ${payable}`, `Pay ${payable}`) : pick('付款后上板', 'Live after payment') }}</span>
          </div>
          <template v-if="true">
            <label class="sr-only" for="bb-url">URL</label>
            <input id="bb-url" v-model="url" type="url" required placeholder="https://yourproduct.com" maxlength="500">
            <label class="sr-only" for="bb-email">Email</label>
            <input id="bb-email" v-model="email" type="email" required placeholder="you@example.com" maxlength="160">
            <label class="sr-only" for="bb-name">{{ pick('产品名（可选）', 'Product name (optional)') }}</label>
            <input id="bb-name" v-model="name" type="text" maxlength="80" :placeholder="pick('产品名（可选）', 'Product name (optional)')">
            <fieldset>
              <legend>{{ pick('意向档位', 'Intended tier') }}</legend>
              <label v-for="tier in BILLBOARD_TIERS" :key="tier.id" class="bb-tier">
                <input v-model="picked" type="radio" name="tier" :value="tier.id" required>
                <span>
                  <b>{{ isZh ? tier.name.zh : tier.name.en }}</b>
                  <small>{{ isZh ? tier.blurb.zh : tier.blurb.en }}</small>
                </span>
                <span class="bb-tier__price">
                  <s v-if="tierQuote(tier.id).strikeLabel">{{ tierQuote(tier.id).strikeLabel }}</s>
                  {{ tierQuote(tier.id).priceLabel }}
                </span>
              </label>
            </fieldset>
            <button class="btn btn--primary btn--block" type="submit" :disabled="busy">
              {{ pick('去付款', 'Pay now') }}
            </button>
            <p v-if="error" class="bb-claim__error">{{ error }}</p>
            <p v-if="done" class="bb-claim__fine">{{ pick(`应付 ${done}`, `Amount due ${done}`) }}</p>
            <p class="bb-claim__fine">
              {{
                pick(
                  '按钮上的价格就是结账实付。未付款不会公开。',
                  'The price on the button is the checkout charge. Unpaid rows are not published.',
                )
              }}
              <template v-if="promoOn">
                {{ pick(`截止 ${deadline}（Asia/Shanghai）。`, `Ends ${deadline} (Asia/Shanghai).`) }}
              </template>
            </p>
          </template>
        </form>
      </div>

      <section class="bb-rank" aria-labelledby="bb-rank-title" data-billboard-source="api/billboard">
        <h2 id="bb-rank-title">{{ pick('已确认的排行', 'Confirmed ranking') }}</h2>
        <p>
          {{
            pick(
              '和首页 Top 10 同一份数据。超过 10 条时，其余只在本页。',
              'Same data as the homepage Top 10. Past ten, the rest are only on this page.',
            )
          }}
        </p>
        <ol v-if="ranked.length">
          <li v-for="(row, index) in ranked" :key="row.id" :class="{ 'is-top': index < 10 }">
            <span class="bb-rank__n">{{ index + 1 }}</span>
            <span class="bb-rank__logo">
              <ToolLogo :logo="row.logo" :name="row.name" :size="40" decorative />
            </span>
            <span class="bb-rank__meta">
              <strong>
                {{ row.name }}
                <em>BILLBOARD</em>
              </strong>
              <span>{{ row.tagline }}</span>
            </span>
            <span class="bb-price">{{ tierPriceLabel(row.tier) }}</span>
          </li>
        </ol>
        <NuxtLink v-else class="bb-rank__empty" :to="`${localePath('/billboard')}#claim`">
          <span class="bb-rank__n">+</span>
          <span class="bb-rank__logo" aria-hidden="true">?</span>
          <span class="bb-rank__meta">
            <strong>{{ pick('你的产品可以在这里', 'Your product can go here') }}</strong>
            <span>{{ pick('空位。付款成功后才公开。', 'Open. It stays private until payment succeeds.') }}</span>
          </span>
          <span class="bb-price">Claim</span>
        </NuxtLink>
      </section>
    </div>

    <section class="bb-rules">
      <div>
        <p>HOW IT WORKS</p>
        <h2>{{ pick('三条规则。', 'Three rules.') }}</h2>
        <ol class="bb-rules__sample" aria-hidden="true">
          <li><span>Prime</span><b>$49</b></li>
          <li><span>Standard</span><b>$29</b></li>
          <li><span>Entry</span><b>$15</b></li>
        </ol>
      </div>
      <ol>
        <li v-for="rule in rules" :key="rule.n">
          <h3><span>{{ rule.n }}</span>{{ rule.title }}</h3>
          <p>{{ rule.body }}</p>
        </li>
      </ol>
    </section>

    <section class="bb-faq">
      <article v-for="(item, index) in faq" :key="item.q">
        <h3>
          <button type="button" :aria-expanded="openFaq === index" @click="openFaq = openFaq === index ? -1 : index">
            {{ item.q }}
          </button>
        </h3>
        <p v-if="openFaq === index">{{ item.a }}</p>
      </article>
    </section>
  </div>
</template>
