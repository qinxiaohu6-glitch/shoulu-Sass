<script setup lang="ts">
/**
 * /billboard — placements already paid for.
 *
 * New bids are closed. A new banner is the weekly launch-board ad on /book-ad.
 * This page still ranks rows that were paid before the close.
 */
import { BILLBOARD_TOP_N } from '~~/shared/content/billboard'
import { englishCount } from '~~/shared/utils/english-count'
import { centsLabel } from '~~/shared/content/campaign'
import { slugForPlacementUrl } from '~~/shared/utils/billboard'
import { backingLabel, faviconForUrl, type BidOccupant } from '~~/shared/utils/billboard-bid'
import { backingCents } from '~~/shared/utils/billboard'

const { pick, isZh } = useLang()
const localePath = useLocalePath()
const { ranked } = await useBillboard()
const submitted = await useSubmittedTools()
const overrides = useOverrides()

/** Real listing slug for a claimed URL, so the row can link to our product page. */
const urlToSlug = computed(() => {
  const all = mergeDirectory(orderedTools('en', overrides.value), submitted.value, overrides.value)
  const out: Record<string, string> = {}
  for (const row of ranked.value) {
    const slug = slugForPlacementUrl(row.url, all, overrides.value.hidden)
    if (slug) out[row.url] = slug
  }
  return out
})

const filter = ref<'top' | 'under50' | 'under20' | 'landed'>('top')
const openFaq = ref(-1)

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
    title: pick('新出价已关闭', 'New bids are closed'),
    body: pick(
      '已经付款的 Billboard 仍按累计金额留在这张榜上。',
      'A Billboard placement already paid for stays on this board, ranked by the total backed.',
    ),
  },
  {
    n: '02',
    title: pick('发布榜广告按周卖', 'The launch-board ad is weekly'),
    body: pick(
      '新的榜上横幅在预订页按周购买，每周一个品牌，周一到周日。',
      'A new banner on the launch board is booked by the week. One brand per week, Monday to Sunday.',
    ),
  },
  {
    n: '03',
    title: pick('不会自动续费', 'Nothing renews'),
    body: pick('周广告到期即下架。想再展示一周，再订一周。', 'A weekly ad comes down when its week ends. Book another week to show it again.'),
  },
])

const faq = computed(() => [
  {
    q: pick('我买到的是什么？', 'What am I buying?'),
    a: pick(
      '这页现在展示已经付款的 Billboard。新的榜上广告按周预订，不承诺搜索排名或流量。',
      'This page shows Billboard placements that were already paid for. A new launch-board ad is booked by the week. No promise of search rank or traffic.',
    ),
  },
  {
    q: pick('这是订阅吗？', 'Is the payment recurring?'),
    a: pick(
      '不是。Billboard 的已付款项是一次付清。新的发布榜广告按周租，不会自动续费。',
      'No. A Billboard placement already paid for was a one-time charge. The new launch-board ad is rented by the week and does not renew.',
    ),
  },
  {
    q: pick('被人超过会怎样？', 'Can someone knock me off?'),
    a: pick(
      '已经付款的位置还在。新出价已关闭，所以不能再为同一产品加价。',
      'A spot already paid for stays. New bids are closed, so you cannot add to the same product.',
    ),
  },
  {
    q: pick('什么时候上线？', 'When does it go live?'),
    a: pick('付款成功后上线，没有审核队列。', 'It goes live when payment succeeds. There is no review queue.'),
  },
  {
    q: pick('要登录吗？', 'Do I need an account?'),
    a: pick(
      '预订周广告不需要先提交收录。免费目录提交仍然走提交页的登录。',
      'Booking a weekly ad does not require a listing first. A free directory submission still uses the sign-in on the submit page.',
    ),
  },
])

const filters = computed(() => [
  { id: 'top' as const, label: pick('前列', 'Top spots') },
  { id: 'under50' as const, label: pick('$50 以下', 'Under $50') },
  { id: 'under20' as const, label: pick('$20 以下', 'Under $20') },
  { id: 'landed' as const, label: pick('刚登上', 'Just landed') },
])

function rankOf(id: string): number {
  const index = ranked.value.findIndex((row) => row.id === id)
  return index < 0 ? 1 : index + 1
}

useSeo({
  title: computed(() => pick('Billboard · dirtool', 'The Billboard · dirtool')),
  description: computed(() =>
    pick(
      'Billboard 新出价已关闭。已经付款的展示仍留在榜上。新的发布榜广告按周预订。',
      'New Billboard bids are closed. Placements already paid for stay on the board. A new launch-board ad is booked by the week.',
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
        <p class="bb-page__from">{{ pick('新出价已关闭', 'New bids are closed') }}</p>
        <h1>{{ pick('Billboard', 'The Billboard') }}</h1>
        <p class="bb-page__tag">{{ pick('已经付款的展示留在榜上。', 'Placements already paid for stay on the board.') }}</p>
        <p class="bb-page__desc">
          {{
            pick(
              '这张榜仍按已付金额排序。新的发布榜横幅改到按周预订，每周一个品牌。',
              'This board still ranks placements already paid for. A new banner is booked by the week, one brand per week.',
            )
          }}
        </p>

        <div id="claim" class="bb-claim">
          <div class="bb-claim__head">
            <h2>{{ pick('预订发布榜广告', 'Book the launch-board ad') }}</h2>
            <span>{{ pick('按周，不自动续费', 'Weekly, no renewal') }}</span>
          </div>
          <NuxtLink class="btn btn--primary btn--block" :to="localePath('/book-ad') + '?slot=board&weeks=1'">
            {{ pick('去预订', 'Book a week') }}
            →
          </NuxtLink>
          <p class="bb-claim__fine">
            {{
              pick(
                'Billboard 不再接受新出价。已经付款的位置不会被删掉。',
                'Billboard does not take a new bid. A placement already paid for is not removed.',
              )
            }}
          </p>
        </div>
      </div>

      <section class="bb-rank" aria-labelledby="bb-rank-title" data-billboard-source="api/billboard">
        <h2 id="bb-rank-title">{{ pick('实时排行', 'Live ranking') }}</h2>
        <p class="bb-rank__stats">
          {{ centsLabel(totalBacked) }} {{ pick('累计', 'backed') }}
          · {{ ranked.length }} {{ isZh ? '个位置' : englishCount(ranked.length, 'spot') }}
          · {{ pick('前 5 名同步首页', 'Top 5 on the homepage') }}
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
                <!-- The spot is sold as a link to the buyer's own site, so a row
                     whose product is not also a directory listing still has to
                     be clickable — it used to render as plain text and the row
                     did nothing at all. -->
                <NuxtLink
                  v-if="urlToSlug[row.url]"
                  class="bb-rank__hit"
                  :to="localePath(`/products/${urlToSlug[row.url]}`)"
                >
                  {{ row.name }} <em>BILLBOARD</em>
                </NuxtLink>
                <a
                  v-else
                  class="bb-rank__hit"
                  :href="row.url"
                  target="_blank"
                  rel="sponsored nofollow noopener"
                >
                  {{ row.name }} <em>BILLBOARD</em>
                </a>
              </strong>
              <span>{{ row.tagline }}</span>
            </span>
            <span class="bb-rank__side">
              <span class="bb-price">{{ backingLabel(row) }}</span>
              <NuxtLink class="bb-rank__go" :to="localePath('/book-ad') + '?slot=board&weeks=1'">
                {{ pick('改订周广告', 'Book a week') }}
              </NuxtLink>
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
              <NuxtLink class="bb-rank__go" :to="localePath('/book-ad') + '?slot=board&weeks=1'">
                {{ pick('改订周广告', 'Book a week') }}
              </NuxtLink>
            </span>
          </li>
        </ol>
        <p v-if="ranked.length > BILLBOARD_TOP_N" class="bb-claim__fine">
          {{ pick('第 11 名及以后只在本页。新出价已关闭。', 'Rank 11 and below stay on this page. New bids are closed.') }}
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
              '已经付款的 Billboard 留在这张榜上。新的横幅去预订页按周买。',
              'Billboard placements already paid for stay on this board. A new banner is booked by the week.',
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
          <button
            type="button"
            :aria-expanded="openFaq === index"
            :aria-controls="openFaq === index ? `billboard-faq-panel-${index}` : undefined"
            @click="openFaq = openFaq === index ? -1 : index"
          >
            {{ item.q }}
            <span aria-hidden="true">{{ openFaq === index ? '–' : '+' }}</span>
          </button>
        </h3>
        <Transition name="content-reveal">
          <p v-if="openFaq === index" :id="`billboard-faq-panel-${index}`">{{ item.a }}</p>
        </Transition>
      </article>
    </section>

    <section class="bb-close">
      <div>
        <h2>{{ pick('新的榜上广告按周预订。', 'A new board ad is booked by the week.') }}</h2>
        <p>
          {{ pick('每周一个品牌。周一到周日。不会自动续费。', 'One brand per week. Monday to Sunday. Nothing renews.') }}
        </p>
      </div>
      <NuxtLink :to="localePath('/book-ad') + '?slot=board&weeks=1'">{{ pick('去预订', 'Book a week') }} →</NuxtLink>
    </section>
  </div>
</template>

<style scoped>
.bb-rank li {
  position: relative;
}
.bb-rank__meta strong a {
  color: inherit;
  text-decoration: none;
}
.bb-rank__meta strong a:hover {
  color: var(--primary, #b45309);
  text-decoration: underline;
  text-underline-offset: 3px;
}
/* The whole row is the target, not just the product name — a 44px icon is not
   a tap area on a phone, and the row already reads as one block. The claim
   button has to sit above the overlay or it stops being a button. */
.bb-rank__hit::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}
.bb-rank__go {
  position: relative;
  z-index: 1;
}
/* Only rows that link somewhere react to hover; an empty slot already says so
   with its dashed border and its own button. */
.bb-rank li:hover:has(.bb-rank__hit) {
  border-color: #d6cfc4;
}
</style>
