<script setup lang="ts">
/**
 * /billboard — pay what you want, from the bid floor.
 *
 * Guest claim exception: the claim modal and the invoice request do not
 * require a session. Submitting a directory listing at /submit still uses
 * the existing sign-in gate. A later payment for the same URL stacks on read.
 * When card checkout is off, the button stores an invoice and does not charge.
 */
import { BILLBOARD_TOP_N } from '~~/shared/content/billboard'
import { centsLabel } from '~~/shared/content/campaign'
import {
  amountToTakeRank,
  backingLabel,
  BILLBOARD_FLOOR_CENTS,
  faviconForUrl,
  type BidOccupant,
} from '~~/shared/utils/billboard-bid'
import { backingCents } from '~~/shared/utils/billboard'

const { pick, isZh } = useLang()
const { ranked } = await useBillboard()
const { ready: paymentReady } = await usePayment()

const url = ref('')
const busy = ref(false)
const done = ref(false)
const error = ref('')
const modalOpen = ref(false)
const presetCents = ref<number | null>(null)
const filter = ref<'top' | 'under50' | 'under20' | 'landed'>('top')
const openFaq = ref(-1)

const floorLabel = centsLabel(BILLBOARD_FLOOR_CENTS)

const occupants = computed<BidOccupant[]>(() =>
  ranked.value.map((row) => ({
    url: row.url,
    amountCents: backingCents(row),
    paidAt: row.paidAt,
  })),
)

const visible = computed(() => {
  const rows = ranked.value
  if (filter.value === 'under50') return rows.filter((row) => backingCents(row) < 5000)
  if (filter.value === 'under20') return rows.filter((row) => backingCents(row) < 2000)
  if (filter.value === 'landed') {
    return [...rows].sort(
      (a, b) => (b.latestPaidAt ?? b.paidAt) - (a.latestPaidAt ?? a.paidAt) || (a.id < b.id ? -1 : 1),
    )
  }
  return rows
})

const openSlots = computed(() => Math.max(0, BILLBOARD_TOP_N - ranked.value.length))
const totalBacked = computed(() => occupants.value.reduce((sum, row) => sum + row.amountCents, 0))

const rules = computed(() => [
  {
    n: '01',
    title: pick('自己出价', 'Name your price'),
    body: paymentReady.value
      ? pick(`从 ${floorLabel} 起，一次付清。`, `Anything from ${floorLabel}. One-time payment.`)
      : pick(
          `从 ${floorLabel} 起，一次付清。通道未开通时请索取发票。`,
          `Anything from ${floorLabel}. One-time payment. Request an invoice while card checkout is off.`,
        ),
  },
  {
    n: '02',
    title: paymentReady.value ? pick('付款即上线', 'Live the second you pay') : pick('确认后上线', 'Live after confirmation'),
    body: paymentReady.value
      ? pick('付款到账后立即出现在本页。进入前 10 名时同步出现在首页。无需排队审核。', 'Your spot appears on this page the moment payment clears. Top 10 also shows on the homepage. No review queue.')
      : pick('发票确认后上线。进入前 10 名时同步出现在首页。', 'It goes live after the invoice is confirmed. Top 10 also shows on the homepage.'),
  },
  {
    n: '03',
    title: pick('再付一次，向上爬', 'Pay again, climb'),
    body: pick(
      '同一网站的金额会累加。被人超过只掉名次，不会从榜上消失。',
      'Amounts stack on the same website. If someone passes you, you only drop in rank.',
    ),
  },
])

const faq = computed(() => [
  {
    q: pick('我买到的是什么？', 'What am I buying?'),
    a: pick(
      '一个永久的站内展示位，按该网站累计金额排序。前 10 名同时出现在首页。不承诺搜索排名或流量。',
      'A permanent on-site spot, ranked by the total backed for that website. The top 10 also appear on the homepage. No promise of search rank or traffic.',
    ),
  },
  {
    q: pick('这是订阅吗？', 'Is the payment recurring?'),
    a: pick(
      `不是。每一笔都是一次性的，新出价从 ${floorLabel} 起。之后再付是另一次一次性加价，会累加到同一网站上。`,
      `No. Every payment is one-time, from ${floorLabel}. A later payment is another one-time top-up and stacks on the same website.`,
    ),
  },
  {
    q: pick('被人超过会怎样？', 'Can someone knock me off?'),
    a: pick(
      '你的位置还在，只是名次下降。给同一网站再付任意金额（至少地板价）即可爬回去。',
      'Your spot stays. You only drop in rank. Pay again for the same website — at least the floor — and it stacks.',
    ),
  },
  {
    q: pick('什么时候上线？', 'When does it go live?'),
    a: paymentReady.value
      ? pick('付款到账后立即上线，没有审核队列。', 'Live the moment payment clears. There is no review queue.')
      : pick('索取发票后，要等发票确认才上线。确认之前不会公开。', 'After you request an invoice, it goes live once that invoice is confirmed. It is not public before then.'),
  },
  {
    q: pick('要登录吗？', 'Do I need an account?'),
    a: pick(
      '认领这个展示位不需要登录。免费目录提交仍然走提交页的登录。',
      'Claiming this spot does not require a sign-in. A free directory submission still uses the sign-in on the submit page.',
    ),
  },
])

const filters = computed(() => [
  { id: 'top' as const, label: pick('前列', 'Top spots') },
  { id: 'under50' as const, label: pick('$50 以下', 'Under $50') },
  { id: 'under20' as const, label: pick('$20 以下', 'Under $20') },
  { id: 'landed' as const, label: pick('刚登上', 'Just landed') },
])

function openClaim(cents: number | null = null) {
  error.value = ''
  done.value = false
  presetCents.value = cents
  modalOpen.value = true
}

function rankOf(id: string): number {
  const index = ranked.value.findIndex((row) => row.id === id)
  return index < 0 ? 1 : index + 1
}

function claimAt(rank: number) {
  openClaim(amountToTakeRank(rank, occupants.value, url.value))
}

function onChangeUrl() {
  modalOpen.value = false
  nextTick(() => document.getElementById('bb-url')?.focus())
}

async function onSubmit(payload: { email: string; name: string; tagline: string; amountCents: number }) {
  if (busy.value) return
  error.value = ''
  busy.value = true
  try {
    const body = {
      url: url.value,
      email: payload.email,
      name: payload.name,
      tagline: payload.tagline,
      amount_cents: payload.amountCents,
    }
    if (paymentReady.value) {
      const res = await $fetch<{ ok: boolean; url?: string; amount_cents: number; published: boolean }>(
        '/api/billboard/checkout',
        { method: 'POST', body },
      )
      if (!res?.ok || res.published || res.amount_cents !== payload.amountCents || !res.url) {
        throw new Error('unexpected')
      }
      window.location.assign(res.url)
      return
    }
    const res = await $fetch<{ ok: boolean; published: boolean }>('/api/billboard/invoice', {
      method: 'POST',
      body,
    })
    if (!res?.ok || res.published) throw new Error('unexpected')
    done.value = true
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
      `自己出价，从 ${floorLabel} 起。一次付清。前 10 名同步首页。`,
      `Name your price, from ${floorLabel}. One-time. Top 10 also shown on the home page.`,
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
        <p class="bb-page__from">{{ pick(`从 ${floorLabel} 起 · 一次付清`, `From ${floorLabel} · one-time`) }}</p>
        <h1>{{ pick('Billboard', 'The Billboard') }}</h1>
        <p class="bb-page__tag">{{ pick('自己出价。占住这个位置。', 'Name your price. Own your spot.') }}</p>
        <p class="bb-page__desc">
          {{
            pick(
              '按累计金额排名。前 10 名出现在首页。被人超过只掉名次。',
              'Ranked by total backed. Top 10 on the homepage. If someone passes you, you only drop in rank.',
            )
          }}
        </p>

        <form id="claim" class="bb-claim" @submit.prevent="openClaim(null)">
          <div class="bb-claim__head">
            <h2>{{ pick('认领展示位', 'Claim your spot') }}</h2>
            <span>{{ paymentReady ? pick('付款即上线', 'Live the second you pay') : pick('确认后上线', 'After the invoice is confirmed') }}</span>
          </div>
          <label class="sr-only" for="bb-url">URL</label>
          <input id="bb-url" v-model="url" type="url" required placeholder="https://yourproduct.com" maxlength="500">
          <button class="btn btn--primary btn--block" type="submit">
            {{ paymentReady ? pick('认领展示位', 'Claim your spot') : pick('索取发票', 'Request invoice') }}
            →
          </button>
          <ul class="bb-trust">
            <li>{{ pick('长期展示', 'Permanent') }}</li>
            <li>{{ pick('一次付清', 'One payment') }}</li>
            <li>{{ pick('同一网站可累加', 'Stack on the same site') }}</li>
          </ul>
          <p class="bb-claim__fine">
            {{
              paymentReady
                ? pick(
                    `新出价从 ${floorLabel} 起。冷启动地板，此前从 $15 起。`,
                    `New bids start at ${floorLabel}. Cold-start floor; was from $15.`,
                  )
                : pick(
                    `新出价从 ${floorLabel} 起。冷启动地板，此前从 $15 起。发票确认后才上线。`,
                    `New bids start at ${floorLabel}. Cold-start floor; was from $15. It goes live after the invoice is confirmed.`,
                  )
            }}
          </p>
        </form>
      </div>

      <section class="bb-rank" aria-labelledby="bb-rank-title" data-billboard-source="api/billboard">
        <h2 id="bb-rank-title">{{ pick('实时排行', 'Live ranking') }}</h2>
        <p class="bb-rank__stats">
          {{ centsLabel(totalBacked) }} {{ pick('累计', 'backed') }}
          · {{ ranked.length }} {{ pick('个位置', 'spots') }}
          · {{ pick('前 10 名同步首页', 'Top 10 on the homepage') }}
        </p>
        <div class="bb-filters" role="tablist">
          <button
            v-for="item in filters"
            :key="item.id"
            type="button"
            :class="{ 'is-on': filter === item.id }"
            @click="filter = item.id"
          >
            {{ item.label }}
          </button>
        </div>
        <ol>
          <li
            v-for="row in visible"
            :key="row.id"
            :class="{ 'is-top': rankOf(row.id) <= 3 }"
          >
            <span class="bb-rank__n">{{ rankOf(row.id) }}</span>
            <span class="bb-rank__logo">
              <ToolLogo :logo="row.logo || faviconForUrl(row.url)" :name="row.name" :size="40" decorative />
            </span>
            <span class="bb-rank__meta">
              <strong>
                {{ row.name }}
                <em>BILLBOARD</em>
              </strong>
              <span>{{ row.tagline }}</span>
            </span>
            <span class="bb-rank__side">
              <span class="bb-price">{{ backingLabel(row) }}</span>
              <button type="button" class="bb-rank__go" @click="claimAt(rankOf(row.id))">
                {{ pick(`认领 #${rankOf(row.id)} ${centsLabel(amountToTakeRank(rankOf(row.id), occupants, url))}`, `Claim #${rankOf(row.id)} ${centsLabel(amountToTakeRank(rankOf(row.id), occupants, url))}`) }}
              </button>
            </span>
          </li>
          <li v-for="n in filter === 'top' ? openSlots : 0" :key="`open-${n}`" class="is-open">
            <span class="bb-rank__n">{{ ranked.length + n }}</span>
            <span class="bb-rank__logo" aria-hidden="true">+</span>
            <span class="bb-rank__meta">
              <strong>{{ pick('空位', 'Open slot') }}</strong>
              <span>{{ pick('付款确认后公开。', 'Public after payment is confirmed.') }}</span>
            </span>
            <span class="bb-rank__side">
              <button type="button" class="bb-rank__go" @click="claimAt(ranked.length + n)">
                {{ pick(`认领 · ${floorLabel} 起`, `Claim · from ${floorLabel}`) }}
              </button>
            </span>
          </li>
        </ol>
        <p v-if="ranked.length > BILLBOARD_TOP_N" class="bb-claim__fine">
          {{ pick('第 11 名及以后只在本页。再加一笔就可能进首页。', 'Rank 11 and below stay on this page. One more backing can reach the homepage.') }}
        </p>
      </section>
    </div>

    <section class="bb-rules">
      <div>
        <p>HOW IT WORKS</p>
        <h2>{{ pick('三条规则。没有小字。', 'Three rules. No small print.') }}</h2>
        <p class="bb-rules__lead">
          {{
            pick(
              '看一个产品在榜上的位置，然后出价，再往上爬。这就是全部。',
              'Watch a product on the board, then pay again and take the top. That is the whole game.',
            )
          }}
        </p>
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
        <h2>{{ pick(`首页前 10 名。从 ${floorLabel} 起。`, `Homepage Top 10. From ${floorLabel}.`) }}</h2>
        <p>
          {{
            paymentReady
              ? pick('一次付清。付款即上线。位置长期保留。', 'One-time payment. Live the second you pay. The spot stays.')
              : pick('一次付清。发票确认后上线。位置长期保留。', 'One-time payment. Live after the invoice is confirmed. The spot stays.')
          }}
        </p>
      </div>
      <a href="#claim">{{ paymentReady ? pick('认领展示位', 'Claim your spot') : pick('索取发票', 'Request invoice') }} →</a>
    </section>

    <BillboardClaimDialog
      :open="modalOpen"
      :url="url"
      :occupants="occupants"
      :payment-ready="paymentReady"
      :busy="busy"
      :error="error"
      :done="done"
      :preset-cents="presetCents"
      @close="modalOpen = false"
      @change-url="onChangeUrl"
      @submit="onSubmit"
    />
  </div>
</template>
