<script setup lang="ts">
/**
 * /alternatives/<platform> — one page per launch platform this site is
 * compared against.
 *
 * The hub answers "which launch site should I use". These pages answer the
 * narrower question someone actually types: "DevHunt alternative". Same data
 * source as the hub (`LAUNCH_PLATFORMS`), so the rhythm and the "best for"
 * line cannot disagree between the table and the page.
 *
 * Editorial limits, same as the hub: describe the other platform only by its
 * launch rhythm and its audience, never its price, traffic or authority, and
 * never claim this site will produce any of those. An unknown slug is a 404,
 * not a page with an empty heading.
 */
import { LAUNCH_PLATFORMS, launchPlatform } from '~~/shared/content/launch-platforms'
import { effectiveQuote } from '~~/shared/utils/pricing-effective'
import { breadcrumbSchema, faqPageSchema } from '~~/shared/utils/schema'

const { pick, isZh } = useLang()
const localePath = useLocalePath()
const route = useRoute()

const platform = computed(() => launchPlatform(String(route.params.platform ?? '')))

if (!platform.value) {
  throw createError({
    statusCode: 404,
    statusMessage: isZh.value ? '没有这个平台的对比页' : 'No comparison page for that platform',
    fatal: true,
  })
}

const name = computed(() => platform.value?.name ?? '')
const rhythm = computed(() => (isZh.value ? platform.value?.rhythm.zh : platform.value?.rhythm.en) ?? '')
const best = computed(() => (isZh.value ? platform.value?.best.zh : platform.value?.best.en) ?? '')
const note = computed(() => (isZh.value ? platform.value?.note.zh : platform.value?.note.en) ?? '')

const boostLabel = computed(() => effectiveQuote('listing', 'boost').priceLabel)

const ours = computed(() => [
  { label: pick('发布节奏', 'Launch rhythm'), value: pick('每周 · UTC 周一到周日', 'Weekly, Monday to Sunday (UTC)') },
  { label: pick('适合', 'Best for'), value: pick('独立开发者、个人创始人和小团队', 'Indie makers, solo founders and small teams') },
  { label: pick('链接', 'Backlink'), value: pick('付费收录 dofollow，免费收录 nofollow', 'Dofollow on paid listings, nofollow on free ones') },
  { label: pick('页面', 'Product page'), value: pick('永久产品页，可被搜索引擎收录', 'A permanent page that search engines can index') },
])

const faq = computed(() => [
  {
    q: pick(`本站是好的 ${name.value} 替代品吗？`, `Is this site a good ${name.value} alternative?`),
    a: pick(
      `如果比起单次发布你更想要一整周的时间，是的。${name.value} 适合：${best.value}。本站每周一个榜单，产品在榜上待七天，期间持续收集投票和反馈。`,
      `Yes, if you would rather have a full week than a single push. ${name.value} is best for: ${best.value}. This site runs one board per week, so a product stays visible for seven days and collects votes the whole time.`,
    ),
  },
  {
    q: pick(`可以同时发布在 ${name.value} 和本站吗？`, `Can I launch on ${name.value} and here?`),
    a: pick(
      '可以，而且大多数人是这么做的。常见做法是先在本站发布一周，拿到投票、反馈和徽章，再去别的平台发布时就有东西可展示。',
      'Yes, and most makers do. A common plan is to launch here for the week, then use the votes, feedback and badge when you launch elsewhere.',
    ),
  },
  {
    q: pick('在本站发布要花钱吗？', 'Is it free to launch here?'),
    a: pick(
      `免费发布需要人工审核后上线，链接是 nofollow。付费加速 ${boostLabel.value} 一次付清：付款成功即刻上线、带金色认证徽章，链接始终 dofollow。两种都不需要订阅，不会自动续费。`,
      `A free listing is reviewed by hand before it goes live and its link is nofollow. Boost is ${boostLabel.value} one-time: live as soon as payment succeeds, with a gold verified badge and an always-dofollow link. Neither is a subscription and nothing renews.`,
    ),
  },
  {
    q: pick('在本站，一次发布持续多久？', 'How long does a launch last here?'),
    a: pick(
      '一个完整的 ISO 周，从周一 00:00 UTC 到周日结束。每周前三名进入往期榜单，并保留在产品页上。',
      'One full ISO week, Monday 00:00 UTC to the end of Sunday. The top three of each week are kept in the archive and stay on their product page.',
    ),
  },
])

const others = computed(() => LAUNCH_PLATFORMS.filter((item) => item.slug !== platform.value?.slug))

const openFaq = ref<number | null>(null)

useSeo({
  title: computed(() =>
    pick(`最值得考虑的 ${name.value} 替代品 · dirtool`, `Best ${name.value} alternative for indie makers · dirtool`),
  ),
  description: computed(() =>
    pick(
      `在找 ${name.value} 的替代品？对比 ${name.value} 与 dirtool 的发布节奏、适合人群与链接方式。免费发布，或一次付费加速。`,
      `Looking for a ${name.value} alternative? Compare ${name.value} and dirtool: launch rhythm, who each is for, and how backlinks work. Launch free, or boost once.`,
    ),
  ),
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify(
          faqPageSchema(faq.value.map((item) => ({ question: item.q, answer: item.a }))),
        ),
      ),
    },
    {
      type: 'application/ld+json',
      innerHTML: computed(() =>
        JSON.stringify(
          breadcrumbSchema([
            { name: pick('发现', 'Discover'), path: '/' },
            { name: pick('发布平台对比', 'Launch platforms'), path: '/alternatives' },
            { name: pick(`${name.value} 替代品`, `${name.value} alternative`), path: `/alternatives/${platform.value?.slug}` },
          ]),
        ),
      ),
    },
  ],
})
</script>

<template>
  <div class="container alt-sub">
    <nav class="breadcrumb" :aria-label="pick('面包屑', 'breadcrumb')">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <NuxtLink :to="localePath('/alternatives')">{{ pick('发布平台对比', 'Launch platforms') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>{{ pick(`${name} 替代品`, `${name} alternative`) }}</span>
    </nav>

    <header class="alt-sub__head">
      <p class="alt-sub__kicker">{{ pick('发布平台', 'LAUNCH PLATFORMS') }}</p>
      <h1>{{ pick(`${name} 替代品`, `${name} alternative`) }}</h1>
      <p class="alt-sub__lead">
        {{
          pick(
            `在找 ${name} 的替代品？下面是 ${name} 和本站的区别：发布节奏、适合人群、链接方式。`,
            `Looking for a ${name} alternative? Here is how ${name} and this site differ: launch rhythm, who each is for, and how links work.`,
          )
        }}
      </p>
    </header>

    <section class="alt-sub__pair" :aria-label="pick('并排对比', 'Side by side')">
      <article class="alt-sub__card">
        <h2>{{ name }}</h2>
        <dl>
          <dt>{{ pick('发布节奏', 'Launch rhythm') }}</dt>
          <dd>{{ rhythm }}</dd>
          <dt>{{ pick('适合', 'Best for') }}</dt>
          <dd>{{ best }}</dd>
        </dl>
        <p class="alt-sub__note">{{ note }}</p>
      </article>

      <article class="alt-sub__card alt-sub__card--ours">
        <h2>dirtool</h2>
        <dl>
          <template v-for="row in ours" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </template>
        </dl>
        <p class="alt-sub__note">
          {{
            pick(
              '一个榜单跑一整周，所以产品不会在第二天早上就消失。',
              'One board runs for a full week, so a product does not disappear the next morning.',
            )
          }}
        </p>
      </article>
    </section>

    <section aria-labelledby="alt-sub-when">
      <h2 id="alt-sub-when" class="alt-sub__h2">{{ pick('什么时候选哪个', 'When to pick which') }}</h2>
      <div class="alt-sub__when">
        <p>
          {{
            pick(
              `如果你要在同一天把所有人都叫来，选 ${name}。${best}。`,
              `Pick ${name} when you can bring everyone on the same day. It is built for: ${best.toLowerCase()}.`,
            )
          }}
        </p>
        <p>
          {{
            pick(
              '如果你想让产品在榜上待久一点、边发布边收反馈，选本站的每周榜单。两者不冲突，多数人会两边都发。',
              'Pick the weekly board here when you want the product to stay up longer and collect feedback while it is live. The two do not conflict, and most makers use both.',
            )
          }}
        </p>
      </div>
    </section>

    <section aria-labelledby="alt-sub-faq">
      <h2 id="alt-sub-faq" class="alt-sub__h2">{{ pick('常见问题', 'Questions') }}</h2>
      <div class="alt-sub__faq">
        <article v-for="(item, i) in faq" :key="item.q" class="alt-sub__faq-item">
          <h3>
            <button type="button" :aria-expanded="openFaq === i" @click="openFaq = openFaq === i ? null : i">
              {{ item.q }}
              <Icon name="chevron-down" :size="18" :class="{ 'is-open': openFaq === i }" />
            </button>
          </h3>
          <p v-if="openFaq === i">{{ item.a }}</p>
        </article>
      </div>
    </section>

    <section class="alt-sub__cta">
      <h2>{{ pick('本周发布你的产品', 'Launch your product this week') }}</h2>
      <p>
        {{
          pick(
            `免费发布，或 ${boostLabel} 一次付费加速。没有订阅。`,
            `Launch free, or boost once for ${boostLabel}. No subscription.`,
          )
        }}
      </p>
      <div class="alt-sub__btns">
        <NuxtLink class="alt-sub__btn alt-sub__btn--primary" :to="localePath('/submit')">
          {{ pick('提交产品', 'Submit a product') }}
        </NuxtLink>
        <NuxtLink class="alt-sub__btn" :to="localePath('/pricing')">{{ pick('查看定价', 'See pricing') }}</NuxtLink>
      </div>
    </section>

    <section aria-labelledby="alt-sub-others">
      <h2 id="alt-sub-others" class="alt-sub__h2">{{ pick('其他发布平台', 'Other launch platforms') }}</h2>
      <div class="alt-sub__grid">
        <NuxtLink
          v-for="item in others"
          :key="item.slug"
          class="alt-sub__link"
          :to="localePath(`/alternatives/${item.slug}`)"
        >
          <strong>{{ item.name }} {{ pick('替代品', 'alternative') }}</strong>
          <span>{{ isZh ? item.rhythm.zh : item.rhythm.en }}</span>
        </NuxtLink>
      </div>
    </section>

    <p class="alt-sub__footnote">
      {{
        pick(
          '产品名归各自所有者。关于其他平台的信息是概括性的，可能变化，以其官网当前的规则和价格为准。',
          'Product names belong to their owners. Details about other platforms are general and can change; check their sites for current rules and prices.',
        )
      }}
    </p>
  </div>
</template>

<style scoped>
.alt-sub { padding-top: 28px; padding-bottom: 60px; }
.alt-sub__head { max-width: 760px; margin: 10px 0 28px; }
.alt-sub__kicker { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; color: #b45309; }
.alt-sub__head h1 { margin: 8px 0 12px; font-size: 34px; letter-spacing: -0.03em; }
.alt-sub__lead { margin: 0; font-size: 17px; line-height: 1.6; color: var(--muted-foreground); }
.alt-sub__h2 { margin: 36px 0 16px; font-size: 24px; letter-spacing: -0.02em; }
.alt-sub__pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.alt-sub__card { padding: 22px; border: 1px solid var(--border); border-radius: 16px; background: var(--card); }
.alt-sub__card--ours { background: #fff8e8; border-color: #f0d48a; }
.alt-sub__card h2 { margin: 0 0 14px; font-size: 19px; letter-spacing: -0.02em; }
.alt-sub__card--ours h2 { color: #b45309; }
.alt-sub__card dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; }
.alt-sub__card dt { font-size: 12px; letter-spacing: 0.04em; color: var(--muted-foreground); text-transform: uppercase; padding-top: 2px; }
.alt-sub__card dd { margin: 0; font-size: 14px; line-height: 1.5; }
.alt-sub__note { margin: 16px 0 0; padding-top: 14px; border-top: 1px dashed var(--border); font-size: 13px; line-height: 1.7; color: var(--muted-foreground); }
.alt-sub__when { display: grid; gap: 12px; }
.alt-sub__when p { margin: 0; padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); font-size: 14px; line-height: 1.7; }
.alt-sub__faq { border-top: 1px solid var(--border); }
.alt-sub__faq-item { border-bottom: 1px solid var(--border); }
.alt-sub__faq-item h3 { margin: 0; }
.alt-sub__faq-item button { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 0; font-size: 15px; font-weight: 600; text-align: left; background: none; border: 0; cursor: pointer; color: inherit; }
.alt-sub__faq-item button :deep(svg) { width: 18px; height: 18px; flex: none; transition: transform .15s; }
.alt-sub__faq-item button :deep(svg.is-open) { transform: rotate(180deg); }
.alt-sub__faq-item p { margin: 0 0 16px; font-size: 14px; line-height: 1.7; color: var(--muted-foreground); }
.alt-sub__cta { margin-top: 40px; padding: 28px; border-radius: 18px; background: #fff7e6; border: 1px solid #f0d48a; }
.alt-sub__cta h2 { margin: 0 0 8px; font-size: 26px; letter-spacing: -0.02em; }
.alt-sub__cta p { margin: 0 0 18px; font-size: 14px; color: #6b531f; }
.alt-sub__btns { display: flex; flex-wrap: wrap; gap: 10px; }
.alt-sub__btn { display: inline-flex; align-items: center; padding: 10px 18px; border-radius: 10px; border: 1px solid var(--border); background: var(--card); font-size: 14px; font-weight: 600; text-decoration: none; color: inherit; }
.alt-sub__btn--primary { background: #14161a; border-color: #14161a; color: #fff; }
.alt-sub__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.alt-sub__link { display: flex; flex-direction: column; gap: 6px; padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); text-decoration: none; color: inherit; }
.alt-sub__link:hover { border-color: #d9a03a; }
.alt-sub__link strong { font-size: 15px; }
.alt-sub__link span { font-size: 13px; color: var(--muted-foreground); }
.alt-sub__footnote { margin-top: 26px; font-size: 12px; line-height: 1.6; color: var(--muted-foreground); }
@media (max-width: 720px) {
  .alt-sub__pair { grid-template-columns: 1fr; }
  .alt-sub__head h1 { font-size: 28px; }
}
</style>
