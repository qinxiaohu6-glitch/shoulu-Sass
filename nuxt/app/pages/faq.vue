<script setup lang="ts">
/**
 * /faq — short answers, grouped by the thing the visitor is actually asking
 * about, each one ending at the page that goes deeper.
 *
 * The FAQPage JSON-LD is built from `groups` below, not written out a second
 * time. Google requires the markup to match the visible copy, and two copies of
 * the same 20 answers is the fastest way to break that rule by accident.
 *
 * Answers state only what the code and the pricing table actually do — the
 * review windows, the vote rule, the link types and the prices all come from
 * `shared/content/pricing.ts` and `server/utils/votes.ts`.
 */
import { centsLabel } from '~~/shared/content/campaign'
import { adPriceCents } from '~~/shared/content/pricing'
import { effectiveQuote } from '~~/shared/utils/pricing-effective'

const { pick } = useLang()
const tierPrice = (id: string) => effectiveQuote('listing', id).priceLabel
const sidebar = effectiveQuote('sidebar', '1')
const boardLabel = centsLabel(adPriceCents('board', 1))
const bundleLabel = effectiveQuote('sidebar', '4').priceLabel
const localePath = useLocalePath()

useSeo({
  title: computed(() => pick('常见问答 · dirtool', 'Questions · dirtool')),
  description: computed(() =>
    pick(
      '收录、审核、投票、链接、定价与广告位 —— 每个问题一段短答案。',
      'Listing, review, votes, links, pricing and ad slots — a short answer to each.',
    ),
  ),
})

interface Answer {
  q: string
  /** Plain sentence(s). The JSON-LD uses this verbatim. */
  a: string
  /** Where to read more. Rendered after the sentence, kept out of the schema. */
  link?: { label: string; to: string }
}

interface AnswerGroup {
  id: string
  heading: string
  items: Answer[]
}

const groups = computed<AnswerGroup[]>(() => [
  {
    id: 'listing',
    heading: pick('收录', 'Listing'),
    items: [
      {
        q: pick('dirtool 是什么？', 'What is dirtool?'),
        a: pick(
          '一个软件产品目录。每个收录页写产品做什么、分类和创客。付费收录带永久 dofollow 链接；免费收录是 nofollow，并由人工审核。',
          'A directory of software products. Each listing has a page with what the product does, its category, and its maker. Paid listings carry a permanent dofollow link; free listings are nofollow and are reviewed by a person.',
        ),
        link: { label: pick('看全部收录', 'Browse the directory'), to: '/products' },
      },
      {
        q: pick('可以免费收录吗？', 'Can I list for free?'),
        a: pick(
          '可以，$0，页面会留下来，也照常参与每周榜单。链接是 nofollow。免费收录由人工审核。中位审核时间见统计页；忙碌时请按最多 7–14 天来预期。',
          'Yes — $0, the page stays up, and it competes on the weekly board like any other. The link is nofollow. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy.',
        ),
        link: { label: pick('查看定价', 'See pricing'), to: '/pricing' },
      },
      {
        q: pick('审核要多久？', 'How long does review take?'),
        a: pick(
          'Boost 在付款成功后上线。标准、精选和专业档已停售；已经付款的收录保留到原定置顶日期结束。免费收录由人工审核。中位审核时间见统计页；忙碌时请按最多 7–14 天来预期。',
          'Boost goes live when payment succeeds. Standard, Featured, and Pro are no longer sold; a listing already paid for stays until its pin date ends. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy.',
        ),
        link: { label: pick('提交之后会发生什么', 'How it works'), to: '/how-it-works' },
      },
      {
        q: pick('提交时需要一个能收信的邮箱吗？', 'Do I need a working email to submit?'),
        a: pick(
          '需要。收据、审核结果和退款都会发到那个地址，所以每一档都必填，免费档也一样。',
          'Yes. The receipt, the review outcome and any refund all go to that address, so it is required on every plan, free included.',
        ),
        link: { label: pick('去提交', 'Submit a product'), to: '/submit' },
      },
      {
        q: pick('什么情况会被拒收？', 'What gets rejected?'),
        a: pick(
          '垃圾站、只为反链的提交、诈骗与恶意软件与钓鱼、成人内容、骚扰与仇恨、违法商品或服务、赌博、不是你的产品、打不开的站点，以及重复域名。',
          'Spam, submissions made only for the backlink, scams, malware and phishing, adult content, harassment and hate, illegal goods or services, gambling, products you do not own, unreachable sites, and duplicate domains.',
        ),
        link: { label: pick('可接受使用政策', 'Acceptable Use Policy'), to: '/terms-of-service' },
      },
      {
        q: pick('同一个域名能提交两次吗？', 'Can I submit the same domain twice?'),
        a: pick(
          '不能。每个域名只对应一个产品页，重复域名会被拒收。',
          'No. Each domain gets one product page, and a duplicate domain is rejected.',
        ),
      },
    ],
  },
  {
    id: 'votes',
    heading: pick('投票与排名', 'Votes and ranking'),
    items: [
      {
        q: pick('谁能投票？', 'Who can vote?'),
        a: pick(
          '登录后的任何人都可以。未登录的投票请求会被直接拒绝，不会静默丢弃。',
          'Anyone signed in. An anonymous vote is refused outright rather than silently dropped.',
        ),
        link: { label: pick('登录', 'Sign in'), to: '/sign-in' },
      },
      {
        q: pick('一个人能投几次？', 'How many times can one person vote?'),
        a: pick(
          '同一个人对同一个产品，一周只能记一票。重复提交不会累加。',
          'One vote per person per product per week. Sending it twice does not count twice.',
        ),
        link: { label: pick('完整规则', 'Full rules'), to: '/rules' },
      },
      {
        q: pick('榜单什么时候重置？', 'When does the board reset?'),
        a: pick(
          '每周一 00:00 UTC 开新一周，周日 23:59 UTC 结束。上周的结果归档保留，不会被覆盖。',
          'A new week opens every Monday at 00:00 UTC and closes Sunday at 23:59 UTC. Last week is archived, not overwritten.',
        ),
        link: { label: pick('本周榜单', 'This week’s board'), to: '/weekly' },
      },
      {
        q: pick('票数是怎么排的？', 'How is the board ordered?'),
        a: pick(
          '按当周票数从高到低。页面上显示的票数只统计当周，不是累计票；票数不是评分，本站没有星级。',
          'By this week’s votes, high to low. The number shown counts this week only, not all time. A vote is not a rating — there are no stars here.',
        ),
      },
      {
        q: pick('付费能提高排名吗？', 'Does paying improve my rank?'),
        a: pick(
          '不能。付费不增加票数、不改变任何一票的权重、不会把产品往榜单上推。付费收录和免费收录在同一个周榜上，用同一套票数竞争。',
          'No. A payment adds no votes, changes no vote’s weight, and moves nothing up the board. Paid and free listings compete on the same board on the same vote count.',
        ),
        link: { label: pick('付费买的是什么', 'What paying does buy'), to: '/pricing' },
      },
    ],
  },
  {
    id: 'links',
    heading: pick('链接', 'Links'),
    items: [
      {
        q: pick('链接是 dofollow 还是 nofollow？', 'Is the link dofollow or nofollow?'),
        a: pick(
          '付费收录是永久 dofollow，不挂 badge、不复查；免费收录是 nofollow，不传递权重。',
          'Paid listings are permanent dofollow, with no badge and no re-checking. Free listings are nofollow, so no authority passes.',
        ),
        link: { label: pick('链接政策', 'Link policy'), to: '/rules' },
      },
      {
        q: pick('置顶会一直保持吗？', 'Does a pin last forever?'),
        a: pick(
          'Boost 没有限期置顶。已经付款的精选档在目录页和分类页置顶 7 天，专业档在分类页置顶 90 天，到期后链接不变。这两档已停售。',
          'Boost does not add a timed pin. A Featured listing already paid for stays pinned on the directory and its category for 7 days, and Pro for 90 days on its category. The link does not change when the pin ends. Those plans are no longer sold.',
        ),
      },
      {
        q: pick('广告位的链接传递权重吗？', 'Do ad links pass authority?'),
        a: pick(
          '不传递。广告链接一律带 rel="sponsored nofollow" —— 付费外链传递权重正是搜索引擎明确处罚的做法。',
          'No. Every ad link carries rel="sponsored nofollow"; a paid link that passes PageRank is exactly what search engines penalise.',
        ),
      },
    ],
  },
  {
    id: 'pricing',
    heading: pick('定价与广告位', 'Pricing and ad slots'),
    items: [
      {
        q: pick('有哪些档位，多少钱？', 'What are the plans and prices?'),
        a: pick(
          `现在在售的收录是免费 ${tierPrice('free')} 和 Boost ${tierPrice('boost')}，都是一次性付款。标准、精选和专业档已停售。发布榜广告 ${boardLabel}/周，右栏 ${sidebar.priceLabel}/周，连订 4 周 ${bundleLabel}。没有订阅，没有自动续费，没有积分。`,
          `The listing plans for sale are free ${tierPrice('free')} and Boost ${tierPrice('boost')}, both one-time. Standard, Featured and Pro are no longer sold. The launch-board ad is ${boardLabel} a week. The sidebar is ${sidebar.priceLabel} a week, or ${bundleLabel} for four weeks. No subscription, no auto-renewal, no credits.`,
        ),
        link: { label: pick('完整定价表', 'Full pricing table'), to: '/pricing' },
      },
      {
        q: pick('广告位怎么卖？', 'How are ad slots sold?'),
        a: pick(
          `发布榜广告是前三名下面的一条赞助横幅，每周一个品牌，周一到周日，${boardLabel}/周。右栏 ${sidebar.priceLabel}/周，连订 4 周 ${bundleLabel}。都不会自动续费。Billboard 已停止新出价；已经付款的出价仍留在榜上。Billboard 和每周投票榜不是同一份名单。`,
          `The launch-board ad is one sponsored banner under the top 3, one brand per week, Monday to Sunday, at ${boardLabel} a week. The sidebar is ${sidebar.priceLabel} a week, or ${bundleLabel} for four weeks. Nothing renews. New Billboard bids are closed; a bid already paid stays on the board. Billboard is not the weekly vote list.`,
        ),
        link: { label: pick('看 Billboard', 'See Billboard'), to: '/billboard' },
      },
      {
        q: pick('买广告位要先提交产品吗？', 'Do I need a listing to book a slot?'),
        a: pick(
          '不需要，也不需要登录。广告位是租的，按周起算，周一开算、展示 7 天，同一周同一个位置只卖一次。',
          'No listing and no account needed. A slot is rented by the week, starts on a Monday, runs seven days, and one slot is sold once per week.',
        ),
      },
      {
        q: pick('能退款吗？', 'Can I get a refund?'),
        a: pick(
          '若我们没有交付展示位，或错误扣款，我们退款。收录或展示位上线后，不因改主意或效果不好退款。完整条款在计费章节。',
          'If we do not deliver the placement, or we charge you in error, we refund it. After the listing or placement is live, we do not refund a change of mind or weak results. Full terms are in the billing section.',
        ),
        link: { label: pick('计费与退款条款', 'Billing and refunds'), to: '/terms-of-service' },
      },
    ],
  },
  {
    id: 'site',
    heading: pick('关于这个站', 'About the site'),
    items: [
      {
        q: pick('有中文版吗？', 'Is there a Chinese version?'),
        a: pick(
          '有。英文在根路径，中文在 /zh 下，两种语言描述的是同一批收录。',
          'Yes. English lives at the root and Chinese under /zh; both describe the same listings.',
        ),
      },
      {
        q: pick('AI 助手可以引用站上的内容吗？', 'May AI assistants cite this site?'),
        a: pick(
          '可以，摘要、引用、标注来源都允许。具体许可与禁止项写在 /ai.txt，站点地图在 /llms.txt。',
          'Yes — summarising, quoting and citing are all allowed. The exact permissions are in /ai.txt and the site map is /llms.txt.',
        ),
      },
    ],
  },
])

/**
 * FAQPage markup, generated from the same array the page renders. Questions and
 * answers are plain text here because the schema has no way to carry a link;
 * the visible copy adds one, which is allowed as long as the answer itself
 * matches.
 */
const faqSchema = computed(() =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.value.flatMap((group) =>
      group.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    ),
  }),
)

useHead({
  script: [{ type: 'application/ld+json', innerHTML: faqSchema }],
})
</script>

<template>
  <div class="src-page">
    <section class="border-t border-border px-4 py-24 sm:py-32">
      <div class="mx-auto max-w-3xl">
        <div class="mb-16 text-center">
          <h1 class="font-serif text-4xl font-normal tracking-tight sm:text-5xl">
            {{ pick('常见问答', 'Questions') }}
          </h1>
          <p class="mt-5 text-muted-foreground">
            {{
              pick(
                '每个问题一段短答案，答案后面是更详细的页面。',
                'A short answer to each, with the page that goes deeper right after it.',
              )
            }}
          </p>
        </div>

        <nav class="mb-14 rounded-2xl border border-border p-6" :aria-label="pick('目录', 'Contents')">
          <p class="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {{ pick('主题', 'Topics') }}
          </p>
          <ul class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li v-for="group in groups" :key="group.id">
              <a :href="`#${group.id}`" class="text-foreground/80 underline-offset-4 hover:underline">
                {{ group.heading }}
              </a>
            </li>
          </ul>
        </nav>

        <div class="space-y-14">
          <section v-for="group in groups" :id="group.id" :key="group.id" class="scroll-mt-24">
            <h2 class="font-serif text-2xl font-normal tracking-tight sm:text-3xl">
              {{ group.heading }}
            </h2>

            <dl class="mt-6 space-y-8">
              <div v-for="item in group.items" :key="item.q">
                <dt class="text-base font-medium text-foreground">{{ item.q }}</dt>
                <dd class="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {{ item.a }}
                  <NuxtLink
                    v-if="item.link"
                    :to="localePath(item.link.to)"
                    class="ml-1 whitespace-nowrap underline underline-offset-4 hover:text-foreground"
                  >
                    {{ item.link.label }} →
                  </NuxtLink>
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <section class="mt-16 border-t border-border pt-10">
          <h2 class="font-serif text-xl font-normal tracking-tight">
            {{ pick('没找到答案？', 'Not answered here?') }}
          </h2>
          <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
            {{
              pick(
                '完整的排名与收录规则单独写了一页；规则之外的问题，发工单或邮件问我们。',
                'The full ranking and listing rules have their own page. For anything they do not cover, open a ticket or email us.',
              )
            }}
          </p>
          <div class="mt-5 flex flex-wrap gap-3">
            <NuxtLink
              :to="localePath('/rules')"
              class="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium transition hover:border-foreground/30"
            >
              {{ pick('排名与收录规则', 'Ranking rules') }}
            </NuxtLink>
            <NuxtLink
              :to="localePath('/pricing')"
              class="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium transition hover:border-foreground/30"
            >
              {{ pick('定价与广告位', 'Pricing and ad slots') }}
            </NuxtLink>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>
