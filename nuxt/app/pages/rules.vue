<script setup lang="ts">
/**
 * /rules — how the board, the votes, the links and the ad slots actually work.
 *
 * This page exists because the one question a paid directory cannot dodge is
 * "can I buy a rank?". Writing the answer down, in the same numbers the code
 * uses, is cheaper than answering it in support tickets — and it is the only
 * version of that promise a visitor can check against the site's behaviour.
 *
 * Every statement here is copied from the implementation, not from the sales
 * copy. When a rule changes, change it here in the same commit:
 *   - one vote per person per product per ISO week → `server/utils/votes.ts`
 *   - sign-in required to vote                 → `server/api/vote.post.ts`
 *   - board ordered by this week's votes       → `shared/utils/catalog.ts` `boardRows`
 *   - review times, pins, link types, prices   → `shared/content/pricing.ts`
 *   - ad slots run Monday to Sunday, 7 days    → `server/utils/ad-bookings.ts`
 */
const { pick } = useLang()
const localePath = useLocalePath()

useSeo({
  title: computed(() => pick('排名与收录规则 · Product Atlas', 'Ranking rules · Product Atlas')),
  description: computed(() =>
    pick(
      '每周榜单怎么算、票怎么记、链接是 dofollow 还是 nofollow、付费会不会改变排名 —— 全部写在这里。',
      'How the weekly board is counted, how votes are recorded, which links are dofollow, and whether paying changes rank — all of it, in one place.',
    ),
  ),
})

interface RuleSection {
  id: string
  heading: string
  lead?: string
  items: string[]
}

const sections = computed<RuleSection[]>(() => [
  {
    id: 'board',
    heading: pick('每周榜单', 'The weekly board'),
    lead: pick(
      '榜单按 ISO 周计算，周一开新一周。上周的结果归档保留，不会被覆盖。',
      'The board runs on ISO weeks and a new one opens every Monday. Last week’s result is archived, not overwritten.',
    ),
    items: [
      pick(
        '一周从周一 00:00 UTC 开始，到周日 23:59 UTC 结束。',
        'A week runs Monday 00:00 UTC to Sunday 23:59 UTC.',
      ),
      pick(
        '榜单按当周票数从高到低排序；展示的票数只统计当周，不是累计票。',
        'The board is ordered by this week’s votes, high to low. The number shown counts this week only, not all time.',
      ),
      pick(
        '周结束后名次锁定并归档，历史周不会被重新计算。',
        'When the week closes, the order is locked and archived. Past weeks are never recalculated.',
      ),
    ],
  },
  {
    id: 'votes',
    heading: pick('投票', 'Votes'),
    items: [
      pick(
        '必须登录才能投票；未登录的投票请求会被直接拒绝，不会静默丢弃。',
        'You must be signed in to vote. An anonymous vote is refused outright, not silently dropped.',
      ),
      pick(
        '同一个人对同一个产品，一周只能记一票。重复提交不会累加。',
        'One person gets one vote per product per week. Sending it twice does not count twice.',
      ),
      pick(
        '一票就是一票 —— 不按账号年龄加权，也不隐藏票数。',
        'A vote is worth one — it is not weighted by account age, and counts are never hidden.',
      ),
      pick(
        '票数不是评分。本站没有星级、没有打分，请不要把票数当成质量分。',
        'A vote is not a rating. There are no stars and no scores here; do not read the count as a quality score.',
      ),
    ],
  },
  {
    id: 'review',
    heading: pick('收录与审核', 'Listing and review'),
    lead: pick(
      '免费档人工审核；付费档付款成功后由系统自动发布。任何收录上线后仍受可接受使用政策约束，我们保留编辑与下架的权利。',
      'Free listings are reviewed by a person. Paid listings publish automatically once payment succeeds. Every listing stays subject to the Acceptable Use Policy after it goes live, and we may edit or remove it.',
    ),
    items: [
      pick(
        '免费档：人工审核，通常 7–14 天，不保证；高峰可能更长。',
        'Free: manual review, usually 7–14 days, not guaranteed. Busy periods take longer.',
      ),
      pick(
        '标准 / 精选 / 专业：付款成功后由支付回调验签、自动完成订单并发布页面，不需要人工确认收款。',
        'Standard, Featured and Pro: a signed payment webhook settles the order and publishes the page automatically once payment succeeds — nobody confirms the receipt by hand.',
      ),
      pick(
        '会被拒绝或上线后下架的：垃圾站、只为反链的提交、诈骗与恶意软件与钓鱼、成人内容、骚扰与仇恨、违法商品或服务、赌博、不是你的产品、打不开的站点、重复域名。',
        'Rejected or taken down after publication: spam, submissions made only for the backlink, scams, malware and phishing, adult content, harassment and hate, illegal goods or services, gambling, products you do not own, unreachable sites, and duplicate domains.',
      ),
      pick(
        '完整清单与处置方式见《服务条款》的可接受使用政策。',
        'The full list, and what happens when it is enforced, is in the Acceptable Use Policy in our terms.',
      ),
    ],
  },
  {
    id: 'links',
    heading: pick('链接政策', 'Link policy'),
    items: [
      pick(
        '付费收录：永久 dofollow，不挂 badge、不复查。',
        'Paid listings: permanent dofollow, no badge, no re-checking.',
      ),
      pick(
        '免费收录：nofollow，不传递权重。页面照常保留，也照常参与每周榜单。',
        'Free listings: nofollow, so no authority passes. The page stays up and still competes on the weekly board.',
      ),
      pick(
        '精选档在目录页和分类页置顶 7 天，之后回落到标准档排序 —— 链接不变。',
        'Featured pins the listing to the top of the directory and category for 7 days, then it drops back to Standard ordering. The link does not change.',
      ),
      pick(
        '专业档在分类页置顶 90 天。',
        'Pro pins it to the top of its category page for 90 days.',
      ),
    ],
  },
  {
    id: 'paying',
    heading: pick('付费不改变排名', 'Paying never changes rank'),
    lead: pick(
      '付费只买三件事：链接变成 dofollow、排序靠前、一段时间的置顶位置。它买不到票。',
      'Paying buys three things: a dofollow link, a higher position in the directory, and a pin for a fixed period. It does not buy votes.',
    ),
    items: [
      pick(
        '付费不会增加票数、不会改变任何一票的权重、不会把产品往榜单上推。',
        'A payment adds no votes, changes no vote’s weight, and moves nothing up the board.',
      ),
      pick(
        '付费收录和免费收录在同一个周榜上竞争，用的是同一套票数。',
        'Paid and free listings compete on the same weekly board, on the same vote count.',
      ),
      pick(
        '目录页的排序（付费在前）和每周榜单的排序（票数在前）是两件不同的事，不要混在一起看。',
        'Directory order, where paid listings come first, is a different thing from board order, which is votes first. They are not the same list.',
      ),
    ],
  },
  {
    id: 'ads',
    heading: pick('广告位', 'Ad slots'),
    lead: pick(
      '广告位是租的，不是买的：按周起租，周一开算，展示 7 天。',
      'Ad slots are rented, not bought: they start on a Monday and run for seven days.',
    ),
    items: [
      pick(
        '榜单位 $29/周，位置在本周榜单第 3、4 名之间；连投 4 周 $99。',
        'Board slot $29 a week, between 3rd and 4th on this week’s board; $99 for four weeks.',
      ),
      pick(
        '右栏位 $19/周，出现在首页与「最新收录」页的右栏；连投 4 周 $65。',
        'Sidebar slot $19 a week, in the rail on the homepage and the just-added feed; $65 for four weeks.',
      ),
      pick(
        '广告链接一律带 rel="sponsored nofollow"，不传递权重 —— 付费外链传递权重正是搜索引擎明确处罚的做法。',
        'Every ad link carries rel="sponsored nofollow" and passes no authority. A paid link that passes PageRank is exactly what search engines penalise.',
      ),
      pick(
        '买广告位不需要先提交产品，也不需要登录；广告位不参与榜单排名。',
        'Booking a slot needs neither a submission nor an account, and a slot never affects board rank.',
      ),
      pick(
        '同一周同一个位置只卖一次；已被占用的周不会出现在可选列表里。',
        'One slot, one week, one buyer. A week that is already taken does not appear as available.',
      ),
    ],
  },
  {
    id: 'billing',
    heading: pick('计费与退款', 'Billing and refunds'),
    items: [
      pick(
        '全部是一次性付款：没有订阅、没有自动续费、没有积分。',
        'Everything is a one-time payment: no subscription, no auto-renewal, no credits.',
      ),
      pick(
        '退款条件、审核时限与到账时间写在《服务条款》的计费章节，按那一份执行。',
        'The refund conditions, review deadlines and payout times are in the billing section of our terms, and that is the version that applies.',
      ),
      pick(
        '因违反可接受使用政策被下架的付费收录不予退款。',
        'A paid listing removed for breaking the Acceptable Use Policy is not refunded.',
      ),
    ],
  },
])

/** The two documents the rules defer to, linked once so the copy can just name them. */
const termsHref = computed(() => `${localePath('/terms-of-service')}#acceptable-use`)
const billingHref = computed(() => `${localePath('/terms-of-service')}#billing`)
</script>

<template>
  <div class="src-page">
    <section class="border-t border-border px-4 py-24 sm:py-32">
      <div class="mx-auto max-w-3xl">
        <div class="mb-16 text-center">
          <h1 class="font-serif text-4xl font-normal tracking-tight sm:text-5xl">
            {{ pick('排名与收录规则', 'Ranking rules') }}
          </h1>
          <p class="mt-5 text-muted-foreground">
            {{
              pick(
                '这一页写的每一条都来自站点实际的运行逻辑，所以它和你在站上看到的行为一致。',
                'Every rule on this page comes from how the site actually runs, so it matches what you see on the site.',
              )
            }}
          </p>
        </div>

        <nav class="mb-14 rounded-2xl border border-border p-6" :aria-label="pick('目录', 'Contents')">
          <p class="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {{ pick('本页内容', 'On this page') }}
          </p>
          <ul class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li v-for="section in sections" :key="section.id">
              <a :href="`#${section.id}`" class="text-foreground/80 underline-offset-4 hover:underline">
                {{ section.heading }}
              </a>
            </li>
          </ul>
        </nav>

        <div class="space-y-14">
          <section v-for="section in sections" :id="section.id" :key="section.id" class="scroll-mt-24">
            <h2 class="font-serif text-2xl font-normal tracking-tight sm:text-3xl">
              {{ section.heading }}
            </h2>
            <p v-if="section.lead" class="mt-3 text-sm leading-relaxed text-muted-foreground">
              {{ section.lead }}
            </p>
            <ul class="mt-6 space-y-3">
              <li
                v-for="item in section.items"
                :key="item"
                class="flex gap-3 text-sm leading-relaxed text-foreground/90"
              >
                <Icon name="check" :size="16" class="mt-0.5 shrink-0 text-muted-foreground" />
                <span>{{ item }}</span>
              </li>
            </ul>

            <!-- The review and billing sections both defer to the terms; linking
                 from the section that raises the question beats one link in a footer. -->
            <p v-if="section.id === 'review'" class="mt-4 text-sm">
              <NuxtLink :to="termsHref" class="underline underline-offset-4 hover:text-foreground">
                {{ pick('阅读可接受使用政策', 'Read the Acceptable Use Policy') }}
              </NuxtLink>
            </p>
            <p v-if="section.id === 'billing'" class="mt-4 text-sm">
              <NuxtLink :to="billingHref" class="underline underline-offset-4 hover:text-foreground">
                {{ pick('阅读计费、退款与取消条款', 'Read the billing, refund and cancellation terms') }}
              </NuxtLink>
            </p>
          </section>
        </div>

        <section class="mt-16 border-t border-border pt-10">
          <h2 class="font-serif text-xl font-normal tracking-tight">
            {{ pick('还有问题？', 'Still unsure?') }}
          </h2>
          <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
            {{
              pick(
                '常见问题在「常见问答」里有短答案；规则之外的情况，发工单或邮件问我们。',
                'The FAQ has short answers to the common ones. For anything these rules do not cover, open a ticket or email us.',
              )
            }}
          </p>
          <div class="mt-5 flex flex-wrap gap-3">
            <NuxtLink
              :to="localePath('/faq')"
              class="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium transition hover:border-foreground/30"
            >
              {{ pick('常见问答', 'Questions') }}
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
