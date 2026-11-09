<script setup lang="ts">
/**
 * /billboard — fixed tiers and the same ranking as the homepage Top 10.
 * Checkout charges `effectiveAmountCents` on the server. This page never sends an amount.
 * When checkout is not ready, the form stores an invoice request and does not open a charge.
 */
import {
  BILLBOARD_TIERS,
  BILLBOARD_TOP_N,
  campaignActive,
  campaignDeadlineShanghai,
  type BillboardTierId,
} from '~~/shared/content/billboard'
import { padBillboard } from '~~/shared/utils/billboard'
import { effectiveQuote } from '~~/shared/utils/pricing-effective'

const { pick, isZh } = useLang()
const { ranked } = await useBillboard()
const { ready: paymentReady } = await usePayment()

const picked = ref<BillboardTierId>('standard')
const url = ref('')
const email = ref('')
const name = ref('')
const busy = ref(false)
const done = ref('')
const error = ref('')
const detailsOpen = ref(false)
const emailInput = ref<HTMLInputElement | null>(null)

const deadline = campaignDeadlineShanghai()
const promoOn = computed(() => campaignActive())

function tierQuote(id: BillboardTierId) {
  return effectiveQuote('billboard', id, Date.now())
}

const selectedQuote = computed(() => tierQuote(picked.value))
const fromQuote = computed(() => tierQuote('entry'))

const slots = computed(() => padBillboard(ranked.value, BILLBOARD_TOP_N))
const overflow = computed(() => ranked.value.slice(BILLBOARD_TOP_N))

const tierLine = computed(() =>
  (['entry', 'standard', 'prime'] as const).map((id) => tierQuote(id).priceLabel).join(' / '),
)

const rules = computed(() => [
  {
    n: '1',
    title: pick('选择档位', 'Choose a tier'),
    body: promoOn.value
      ? pick(
          `入门 / 标准 / 优先。一次付清。Black Friday：${tierLine.value}。`,
          `Entry, Standard, or Prime. One-time payment. Black Friday: ${tierLine.value}.`,
        )
      : pick(
          '入门 / 标准 / 优先。一次付清。',
          'Entry, Standard, or Prime. One-time payment.',
        ),
  },
  {
    n: '2',
    title: pick('付款即上线', 'Live the second you pay'),
    body: pick(
      '付款成功后，展示位立即出现在本页与首页 Top 10。无需排队审核。',
      'Your spot appears right away on this page and the homepage Top 10. No queue.',
    ),
  },
  {
    n: '3',
    title: pick('高档优先', 'Higher tiers rank first'),
    body: pick(
      '优先 > 标准 > 入门。同档先付款者排名更前。每周投票榜独立计算。',
      'Prime, then Standard, then Entry. Within a tier, earlier payment ranks higher. Weekly vote rankings are separate.',
    ),
  },
])

const faq = computed(() => [
  {
    q: pick('购买内容是什么？', 'What am I buying?'),
    a: pick(
      '站内 Billboard 展示位。进入 Top 10 时同步出现在首页。不承诺搜索排名或流量。',
      'An on-site Billboard placement. Top 10 also shown on the home page. No promise of search rank or traffic.',
    ),
  },
  {
    q: pick('是否订阅制？', 'Is it a subscription?'),
    a: pick('否。一次付清。', 'No. One-time payment.'),
  },
  {
    q: pick('多久上线？', 'How soon does it go live?'),
    a: pick('付款成功后立即上线。', 'Live the second you pay.'),
  },
  {
    q: pick('免费收录是否保留？', 'Is free listing still available?'),
    a: pick(
      '保留。免费走目录与周投票榜；付费位标注 BILLBOARD。',
      'Yes. Free stays in the directory and weekly votes. Paid spots are marked BILLBOARD.',
    ),
  },
])

const openFaq = ref(-1)

const ctaLabel = computed(() => {
  const price = selectedQuote.value.priceLabel
  return paymentReady.value
    ? pick(`认领展示位 · ${price}`, `Claim your spot · ${price}`)
    : pick(`索取发票 · ${price}`, `Request invoice · ${price}`)
})

function focusClaim(tier?: BillboardTierId) {
  if (tier) picked.value = tier
  document.getElementById('claim')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  document.getElementById('bb-url')?.focus()
}

async function startCheckout() {
  const quote = selectedQuote.value
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
}

async function requestInvoice() {
  const res = await $fetch<{ ok: boolean; published: boolean }>('/api/billboard/invoice', {
    method: 'POST',
    body: { tier: picked.value, url: url.value, email: email.value, name: name.value },
  })
  if (!res?.ok || res.published) throw new Error('unexpected')
  done.value = 'requested'
}

async function onSubmit() {
  if (busy.value) return
  error.value = ''
  if (!email.value.trim()) {
    detailsOpen.value = true
    error.value = pick('请填写邮箱，以便发送发票。', 'Add an email so we can send the invoice.')
    await nextTick()
    emailInput.value?.focus()
    return
  }
  busy.value = true
  try {
    if (paymentReady.value) await startCheckout()
    else await requestInvoice()
  } catch (err) {
    const info = (err as { data?: { message_zh?: string; message_en?: string } })?.data
    error.value =
      (isZh.value ? info?.message_zh : info?.message_en) ||
      pick('这一步没有完成，请稍后再试。', 'That step did not finish. Try again in a moment.')
  } finally {
    busy.value = false
  }
}

useSeo({
  title: computed(() => pick('Billboard · Product Atlas', 'The Billboard · Product Atlas')),
  description: computed(() =>
    pick(
      '一次付清。付款即上线。首页 Top 10 同步展示。',
      'One payment. Own your spot. Live the second you pay. Top 10 also shown on the home page.',
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
          <s v-if="fromQuote.strikeLabel">{{ fromQuote.strikeLabel }}</s>
          {{ pick(`起价 ${fromQuote.priceLabel} · 一次付清`, `From ${fromQuote.priceLabel} · one-time`) }}
        </p>
        <h1>{{ pick('Billboard', 'The Billboard') }}</h1>
        <p class="bb-page__tag">
          {{ pick('一次付清。永久占位。', 'One payment. Own your spot.') }}
        </p>
        <p class="bb-page__desc">
          {{ pick('付款即上线。首页 Top 10 同步展示。', 'Goes live the second you pay. Top 10 also shown on the home page.') }}
        </p>

        <form id="claim" class="bb-claim" @submit.prevent="onSubmit">
          <div class="bb-claim__head">
            <h2>{{ pick('认领展示位', 'Claim your spot') }}</h2>
            <span>{{ pick('付款即上线', 'Live in seconds') }}</span>
          </div>

          <label class="sr-only" for="bb-url">URL</label>
          <input id="bb-url" v-model="url" type="url" required placeholder="https://yourproduct.com" maxlength="500">

          <fieldset class="bb-tiers">
            <legend>{{ pick('选择档位', 'Choose a tier') }}</legend>
            <label
              v-for="tier in BILLBOARD_TIERS"
              :key="tier.id"
              class="bb-tier-card"
              :class="{ 'is-picked': picked === tier.id }"
            >
              <input v-model="picked" type="radio" name="tier" :value="tier.id" required>
              <span class="bb-tier-card__name">{{ isZh ? tier.name.zh : tier.name.en }}</span>
              <span class="bb-tier-card__price">
                <s v-if="tierQuote(tier.id).strikeLabel">{{ tierQuote(tier.id).strikeLabel }}</s>
                {{ tierQuote(tier.id).priceLabel }}
              </span>
              <small>{{ isZh ? tier.blurb.zh : tier.blurb.en }}</small>
            </label>
          </fieldset>

          <details class="bb-claim__more" :open="detailsOpen" @toggle="detailsOpen = ($event.target as HTMLDetailsElement).open">
            <summary>{{ pick('结账信息', 'Checkout details') }}</summary>
            <label class="sr-only" for="bb-email">Email</label>
            <input
              id="bb-email"
              ref="emailInput"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              maxlength="160"
              autocomplete="email"
            >
            <label class="sr-only" for="bb-name">{{ pick('产品名（可选）', 'Product name (optional)') }}</label>
            <input
              id="bb-name"
              v-model="name"
              type="text"
              maxlength="80"
              :placeholder="pick('产品名（可选）', 'Product name (optional)')"
            >
          </details>

          <button class="btn btn--primary btn--block" type="submit" :disabled="busy">
            {{ busy ? pick('处理中…', 'Working…') : ctaLabel }}
          </button>
          <p v-if="error" class="bb-claim__error">{{ error }}</p>
          <p v-if="done === 'requested'" class="bb-claim__fine">
            {{ pick('发票已记下。付款确认前不会上线。', 'Invoice requested. Nothing goes live until payment clears.') }}
          </p>

          <ul class="bb-trust">
            <li>{{ pick('长期展示', 'Permanent') }}</li>
            <li>{{ pick('一次付清', 'One-time payment') }}</li>
            <li>{{ pick('安全结账', 'Secure checkout') }}</li>
          </ul>
          <p class="bb-claim__fine">
            {{
              pick(
                '按钮价格即为实付金额。未付款不上线。',
                'The button price is what you pay. Nothing goes live until payment clears.',
              )
            }}
            <template v-if="promoOn">
              {{ pick(`Black Friday 截止 ${deadline} Asia/Shanghai。`, `Black Friday ends ${deadline} Asia/Shanghai.`) }}
            </template>
          </p>
        </form>
      </div>

      <section class="bb-rank" aria-labelledby="bb-rank-title" data-billboard-source="api/billboard">
        <h2 id="bb-rank-title">{{ pick('实时排行', 'Live ranking') }}</h2>
        <p>{{ pick('前 10 名同步展示于首页。', 'Top 10 also shown on the home page.') }}</p>
        <ol>
          <li
            v-for="cell in slots"
            :key="cell.rank"
            :class="{ 'is-top': cell.rank <= 3 && cell.kind === 'live', 'is-open': cell.kind === 'empty' }"
          >
            <template v-if="cell.kind === 'live'">
              <span class="bb-rank__n">{{ cell.rank }}</span>
              <span class="bb-rank__logo">
                <ToolLogo :logo="cell.placement.logo" :name="cell.placement.name" :size="40" decorative />
              </span>
              <span class="bb-rank__meta">
                <strong>
                  {{ cell.placement.name }}
                  <em>BILLBOARD</em>
                </strong>
                <span>{{ cell.placement.tagline }}</span>
              </span>
              <button type="button" class="bb-rank__go" @click="focusClaim(cell.placement.tier)">
                {{ cell.placement.tier }}
              </button>
            </template>
            <template v-else>
              <span class="bb-rank__n">{{ cell.rank }}</span>
              <span class="bb-rank__logo" aria-hidden="true">+</span>
              <span class="bb-rank__meta">
                <strong>{{ pick('空位', 'Open slot') }}</strong>
                <span>{{ pick('此处可放置你的产品。付款后公开。', 'Your product can go here. Goes live after payment.') }}</span>
              </span>
              <button type="button" class="bb-rank__go" @click="focusClaim()">
                {{ pick('认领', 'Claim') }}
              </button>
            </template>
          </li>
          <li v-for="(row, index) in overflow" :key="row.id">
            <span class="bb-rank__n">{{ BILLBOARD_TOP_N + index + 1 }}</span>
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
            <button type="button" class="bb-rank__go" @click="focusClaim(row.tier)">
              {{ row.tier }}
            </button>
          </li>
        </ol>
      </section>
    </div>

    <section class="bb-rules">
      <div>
        <p>HOW IT WORKS</p>
        <h2>{{ pick('三条规则。无隐藏条款。', 'Three rules. No small print.') }}</h2>
        <p class="bb-rules__lead">
          {{ pick('选档、付款、上线——全部公开。', 'Choose a tier, pay once, go live. That’s the whole offer.') }}
        </p>
        <ol class="bb-rules__sample" aria-hidden="true">
          <li class="is-yours">
            <span>1</span>
            <b>{{ pick('你的产品', 'Your product') }}</b>
            <em>Prime</em>
          </li>
          <li>
            <span>2</span>
            <b>Standard</b>
          </li>
          <li>
            <span>3</span>
            <b>Entry</b>
          </li>
        </ol>
      </div>
      <ol>
        <li v-for="rule in rules" :key="rule.n">
          <h3><span>{{ rule.n }}</span>{{ rule.title }}</h3>
          <p>{{ rule.body }}</p>
        </li>
      </ol>
    </section>

    <section class="bb-faq" aria-label="FAQ">
      <article v-for="(item, index) in faq" :key="item.q">
        <h3>
          <button type="button" :aria-expanded="openFaq === index" @click="openFaq = openFaq === index ? -1 : index">
            {{ item.q }}
            <span aria-hidden="true">{{ openFaq === index ? '–' : '+' }}</span>
          </button>
        </h3>
        <p v-if="openFaq === index">{{ item.a }}</p>
      </article>
    </section>

    <section class="bb-close">
      <div>
        <h2>
          {{
            promoOn
              ? pick(
                  `首页 Top 10。黑五起价 ${fromQuote.priceLabel}。`,
                  `Homepage Top 10. From ${fromQuote.priceLabel} · Black Friday`,
                )
              : pick(
                  `首页 Top 10，起价 ${fromQuote.priceLabel}。`,
                  `Homepage Top 10. From ${fromQuote.priceLabel}.`,
                )
          }}
        </h2>
        <p>{{ pick('一次付清。付款即上线。长期展示。', 'One-time payment. Live the second you pay. Permanent listing.') }}</p>
      </div>
      <a href="#claim">{{ paymentReady ? pick('认领展示位', 'Claim your spot') : pick('索取发票', 'Request invoice') }} →</a>
    </section>
  </div>
</template>
