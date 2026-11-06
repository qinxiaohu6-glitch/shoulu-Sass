<script setup lang="ts">
const { lang, isZh, pick } = useLang()

const router = useRouter()
// @nuxtjs/i18n v10 exposes this as a composable rather than an auto-import,
// so it has to be pulled in during setup — not inside the submit handler.
const localePath = useLocalePath()

// Community listings, so the "products listed" figure and the newest strip
// agree with /tools and /just-added rather than quietly undercounting.
const submitted = await useSubmittedTools()
const overrides = useOverrides()

/* Category and tag names come from the live taxonomy, not the build-time
   catalogue: the console can rename either, and this page shows both (the tile
   row, the category cards, the pill row, the tag cloud, the board's badges).
   The layout is untouched — only the words in it follow the database. */
const { categories: liveCategories, tags: liveTags } = useDirectoryMeta()

// A booked sidebar placement renders above the rail; `null` renders nothing.
const { sidebar: sidebarAd } = await useAds()

const all = computed(() =>
  mergeDirectory(orderedTools(lang.value, overrides.value), submitted.value, overrides.value),
)

/**
 * The live homepage shows the most recent *archived* week, not the calendar
 * week — `currentWeek()` is empty until the Monday cron writes a row, and
 * falling back to live vote totals there would relabel the board while it is
 * still the previous week's result. So: newest archive, full stop.
 *
 * There are two archives: the weeks baked into the catalogue at build time, and
 * the ones the Monday cron has closed since. The cron's copy wins only when its
 * id is genuinely newer — with an empty `week_archive` this resolves to the
 * catalogue and the page renders exactly as it did before the cron existed.
 */
const archivedWeek = await useBoard()

const latestWeek = computed(() => {
  const newestStatic = [...weeks].sort((a, b) => (a.id < b.id ? 1 : -1))[0]
  const archived = archivedWeek.value
  if (archived && (!newestStatic || archived.id > newestStatic.id)) return archived
  return newestStatic
})

const weekText = computed(() => weekLabel(latestWeek.value, lang.value))
const board = computed(() => boardRows(latestWeek.value, lang.value, 6))

/* "Sponsored" hero card — the one listing that is both paid and featured. */
const heroCard = computed(() => {
  const featured = featuredTools(lang.value, overrides.value)
  return featured.find((tool) => tool.is_paid && tool.is_featured) ?? featured[0]
})

/* The three tiles beside it are a curated set, in this order, on the live site. */
const tileSlugs = ['coding', 'chatbots', 'image']
const tiles = computed(() =>
  tileSlugs
    .map((slug) => categoryBySlug(slug, liveCategories.value))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => localizeCategory(c, lang.value)),
)

const cats = computed(() =>
  liveCategories.value.map((c) => {
    const list = toolsByCategory(c.slug, lang.value, overrides.value)
    // The card's count and vote bar have to match what the category page shows,
    // so submitted listings are counted here too. Thumbnails stay catalogue-only:
    // they are a preview of the curated set, and a submission may have no icon.
    const extra = submitted.value.filter((t) => t.category === c.slug)
    return {
      ...localizeCategory(c, lang.value),
      count: list.length + extra.length,
      votes:
        list.reduce((sum, t) => sum + t.votes_week, 0) +
        extra.reduce((sum, t) => sum + t.votes_week, 0),
      // Thumbnails follow the raw catalogue sequence, not the paid/featured
      // directory order — same rule as the categories index.
      mix: tools
        .filter((t) => !isHiddenTool(t, overrides.value))
        .filter((t) => t.category === c.slug)
        .slice(0, 4)
        .map((t) => localizeTool(t, lang.value)),
    }
  }),
)

const maxCatVotes = computed(() => Math.max(...cats.value.map((c) => c.votes), 1))

const pills = computed(() => pillCategories(lang.value, liveCategories.value))

const latest = computed(() =>
  [...submitted.value, ...latestTools(lang.value, 6, overrides.value)]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 6),
)

const stats = computed(() => [
  { value: String(all.value.length), label: pick('个产品已收录', 'products listed') },
  { value: String(liveCategories.value.length), label: pick('个分类', 'categories') },
  { value: 'dofollow', label: pick('付费收录外链', 'on paid listings') },
  { value: pick('每周一', 'Weekly'), label: pick('榜单重置', 'board reset') },
])

const proofs = computed(() => [
  pick('30 秒提交', '30-second submit'),
  pick('付费收录 dofollow', 'Dofollow on paid'),
  pick('确认收款当天上线', 'Live once payment is confirmed'),
])

const benefits = computed(() => [
  {
    title: pick('付费即得 dofollow 反链', 'A dofollow link when you pay'),
    body: pick(
      '付费收录给 dofollow 外链，免费收录是 nofollow —— 页面照样永久保留。',
      'Dofollow on paid listings, nofollow on free ones — either way the page stays online.',
    ),
    icon: 'link',
  },
  {
    title: pick('AI 搜索读得懂', 'Readable by AI search'),
    body: pick(
      '每个收录都带结构化数据和纯文本版本，ChatGPT、Perplexity 这类 AI 搜索可以直接引用你。',
      'Every listing ships structured data and a plain-markdown copy, so ChatGPT and Perplexity can cite you.',
    ),
    icon: 'sparkles',
  },
  {
    title: pick('每周一次冲榜机会', 'A weekly shot at the top'),
    body: pick(
      '榜单每周一重置。前三名在首页榜单里高亮，也排在周榜页最前 —— 每周重新开始，谁都有机会。',
      'The board resets every Monday. The top three are highlighted on the home board and sit at the top of the weekly page — everyone starts level again each week.',
    ),
    icon: 'trophy',
  },
  {
    title: pick('30 秒完成提交', 'Submitted in 30 seconds'),
    body: pick(
      '粘贴产品链接，我们自动填好资料，你只需确认。不用从空白表单开始。',
      'Paste your URL, we prefill the listing, you confirm. No blank form to fill from scratch.',
    ),
    icon: 'clock',
  },
])

const faq = computed(() =>
  isZh.value
    ? [
        {
          q: '提交要花钱吗？',
          a: '免费收录 0 元，进人工审核队列，通常 7–14 天，不保证；高峰可能更长，链接是 nofollow。标准一次性 $19：付款确认后当天上线（人工确认收款）、永久 dofollow、目录页排在免费收录之前。精选 $39：再加目录页和分类页置顶 7 天、首页精选卡。专业 $69：分类页置顶 90 天、全年 4 次文案修改、站长开启邮件后 24h 内回复。都是单次付费，不是订阅。',
        },
        {
          q: '多久能上线？',
          a: '付费档在站长确认收款后当天上线（人工确认收款）。免费收录由人工审核，通常 7–14 天，不保证；高峰可能更长。',
        },
        {
          q: '免费收录的链接是 nofollow 吗？',
          a: '是。免费不收钱，链接就是 nofollow，页面照样永久保留、照常进每周榜单。要 dofollow 需要付费，付费之后没有附加条件：不用挂我们的 badge，不会定期复查，也不会因为某天忘了续费而消失。',
        },
        {
          q: '上线后还能改吗？',
          a: '可以。在「我的提交」里随时修改，已上线的条目改动后会重新过一遍审核。',
        },
      ]
    : [
        {
          q: 'How much does it cost?',
          a: 'A free listing costs nothing, waits in the review queue (usually 7–14 days, not guaranteed; busy periods can take longer), and carries a nofollow link. Standard is a one-time $19: live the same day payment is confirmed (we confirm receipt by hand), permanent dofollow, listed above every free submission. Featured is $39 and adds a 7-day pin on the directory and category pages plus the homepage card. Pro is $69 for a 90-day category pin, four copy edits a year, and a reply within 24 hours after the site owner turns email on. All one-time payments, never a subscription.',
        },
        {
          q: 'How fast does my listing go live?',
          a: 'Live the same day payment is confirmed (we confirm receipt by hand). Free listings are reviewed by a person, usually 7–14 days, not guaranteed; busy periods can take longer.',
        },
        {
          q: 'Is the free link nofollow?',
          a: 'Yes. Free listings cost nothing, so the link is nofollow — the page still stays up forever and still competes on the weekly board. Dofollow comes with a paid listing, and there are no strings attached to it: no badge to install, no periodic re-check, nothing that expires while you are not looking.',
        },
        {
          q: 'Can I edit after it goes live?',
          a: 'Yes, any time from My submissions. Edits to a live listing are re-reviewed before they publish.',
        },
      ],
)

const openFaq = ref(-1)
const heroUrl = ref('')
const { ensure: ensureSession } = useSession()

/**
 * The old site pushed signed-out visitors through Google before the form, so
 * nobody filled in three steps and then discovered they had to sign in. The
 * address they typed rides inside `next` and comes back with them — it is
 * sealed into the OAuth state cookie, not left in the query string where a
 * third party could edit it.
 */
async function startSubmit() {
  const url = heroUrl.value.trim()
  const target = url ? `/submit?url=${encodeURIComponent(url)}` : '/submit'

  if (!(await ensureSession())) {
    await navigateTo(localePath({ path: '/sign-in', query: { next: target } }))
    return
  }
  router.push(url ? { path: '/submit', query: { url } } : '/submit')
}

const popularTags = computed(() => liveTags.value.slice(0, 15))

useSeo({
  title: computed(() =>
    isZh.value
      ? 'Product Atlas — 发布你的产品，反链永久保留'
      : 'Product Atlas — Launch your product, keep the backlink',
  ),
  description: computed(() =>
    isZh.value
      ? '为 Maker 做的产品目录：免费提交、付费收录给 dofollow 反链、一个 AI 搜索愿意引用的页面，以及每周一重置的榜单。'
      : 'A product directory built for makers: free submission, dofollow backlink on paid placements, a page AI search can cite, and a weekly leaderboard that resets every Monday.',
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
  <div class="container">
    <!-- ── Hero + Top picks ─────────────────────────────────────────────── -->
    <div class="home-top">
      <section class="mk-hero mk-hero--center">
        <p class="mk-eyebrow">{{ pick('写给 Maker', 'For makers') }}</p>

        <h1 v-if="isZh" class="mk-h1">
          发布你的产品，<span class="mk-h1__em">反链永久保留</span>。
        </h1>
        <h1 v-else class="mk-h1">
          Launch your product.<br><span class="mk-h1__em">Keep the backlink forever.</span>
        </h1>

        <p class="mk-sub">
          {{
            pick(
              '付费收录给一条永久 dofollow 反链、一个 AI 搜索读得懂也愿意引用的页面，以及每周一重置的榜单曝光。免费提交也能上，链接是 nofollow。',
              'Paid listings get a permanent dofollow backlink, a page AI search can read and cite, and a weekly leaderboard that resets every Monday. Free listings go up too — nofollow.',
            )
          }}
        </p>

        <form class="mk-url" @submit.prevent="startSubmit">
          <div class="mk-url__row">
            <input
              v-model="heroUrl"
              class="mk-url__input"
              type="text"
              inputmode="url"
              autocomplete="url"
              name="url"
              spellcheck="false"
              :placeholder="pick('https://你的产品.com', 'https://yourtool.com')"
              :aria-label="pick('输入产品网址，登录后进入提交', 'Your product URL — sign in to continue')"
            >
            <button class="btn btn--primary btn--lg mk-url__btn" type="submit">
              {{ pick('免费提交', 'Submit free') }}
              <Icon name="arrow-right" />
            </button>
          </div>
          <ul class="mk-proofs">
            <li v-for="proof in proofs" :key="proof">
              <Icon name="check" />
              {{ proof }}
            </li>
          </ul>
        </form>

        <div class="mk-stats">
          <div v-for="stat in stats" :key="stat.label" class="mk-stat">
            <b>{{ stat.value }}</b>
            <span>{{ stat.label }}</span>
          </div>
        </div>
      </section>

      <aside class="home-top__side">
        <TopPicks :limit="5" />
      </aside>
    </div>

    <!-- ── Main + rail ──────────────────────────────────────────────────── -->
    <div class="home-layout">
      <div class="home-main">
        <!-- What you get -->
        <section>
          <div class="section-head">
            <div class="section-head__title">
              <h2>{{ pick('收录后你能得到什么', 'What you get when you list') }}</h2>
              <p>{{ pick('四件事，每一条收录都有。', 'Four things, on every listing.') }}</p>
            </div>
          </div>
          <div class="get-grid">
            <article v-for="item in benefits" :key="item.title" class="get-card">
              <span class="get-card__ico"><Icon :name="item.icon" /></span>
              <h3>{{ item.title }}</h3>
              <p>{{ item.body }}</p>
            </article>
          </div>
        </section>

        <!-- Featured -->
        <section v-if="heroCard">
          <div class="section-head">
            <div class="section-head__title">
              <h2>{{ pick('精选', 'Featured') }}</h2>
            </div>
            <NuxtLink class="more" :to="localePath('/tools')">
              {{ pick('查看全部', 'View all') }}
              <Icon name="arrow-right" />
            </NuxtLink>
          </div>

          <div class="featured-grid">
            <div class="hero-card">
              <div class="hero-card__glow" aria-hidden="true" />
              <div class="hero-card__inner">
                <div class="hero-card__head">
                  <span class="hero-card__logo">
                    <img :src="`/${heroCard.logo}`" alt="" width="36" height="36" >
                  </span>
                  <span class="badge-pick">{{ pick('赞助', 'Sponsored') }}</span>
                </div>
                <h3>{{ heroCard.name }}</h3>
                <p class="hero-card__desc">{{ heroCard.short }}</p>
                <div class="hero-card__cta">
                  <NuxtLink class="btn btn--primary" :to="localePath(`/tools/${heroCard.slug}`)">
                    {{ pick('查看详情', 'View details') }}
                    <Icon name="arrow-right" />
                  </NuxtLink>
                  <span class="hero-card__meta">
                    <Icon name="arrow-up" />
                    <span>{{ heroCard.votes_week }} {{ pick('票', 'votes') }}</span>
                  </span>
                </div>
              </div>
            </div>

            <div class="featured-tiles">
              <NuxtLink v-for="cat in tiles" :key="cat.slug" class="cat-tile" :to="localePath(`/categories/${cat.slug}`)">
                <span class="cat-tile__icon"><Icon :name="cat.icon" /></span>
                <span class="cat-tile__body">
                  <p>{{ cat.name }}</p>
                  <p>{{ cat.desc }}</p>
                </span>
                <Icon name="chevron-right" />
              </NuxtLink>
            </div>
          </div>
        </section>

        <!-- Category pills — these filter the listing page in place, they do
             not navigate to /categories/<slug>; the cat cards below do that. -->
        <nav class="pills scrollbar-none" :aria-label="pick('分类', 'Categories')">
          <NuxtLink class="pill is-active" :to="localePath('/tools')" aria-current="page">{{ pick('全部', 'All') }}</NuxtLink>
          <NuxtLink
            v-for="cat in pills"
            :key="cat.slug"
            class="pill"
            :to="localePath(`/tools?category=${cat.slug}`)"
          >
            {{ cat.name }}
          </NuxtLink>
        </nav>

        <!-- This week's board -->
        <section>
          <div class="section-head">
            <div class="section-head__title">
              <h2>{{ pick('本周榜单', "This week's board") }}</h2>
              <p>{{ weekText }} · {{ pick('每周一重置', 'resets every Monday') }}</p>
            </div>
            <NuxtLink class="more" :to="localePath('/weekly')">
              {{ pick('查看全部', 'View all') }}
              <Icon name="arrow-right" />
            </NuxtLink>
          </div>

          <ol class="board">
            <li
              v-for="row in board"
              :key="row.tool?.slug || row.rank"
              class="board__row"
              :class="{ 'is-top': row.rank <= 3 }"
            >
              <NuxtLink v-if="row.tool" class="board__link" :to="localePath(`/tools/${row.tool.slug}`)">
                <span class="board__rank" :class="{ 'is-top': row.rank <= 3 }">{{ row.rank }}</span>
                <span class="tool-icon" style="width: 38px; height: 38px">
                  <img :src="`/${row.tool.logo}`" alt="" width="38" height="38" loading="lazy" >
                </span>
                <span class="board__body">
                  <span class="board__name">{{ row.tool.name }}</span>
                  <span class="board__desc">{{ row.tool.short }}</span>
                </span>
                <span class="board__meta">
                  <span class="board__tag">
                    <Icon name="shapes" />
                    {{
                      categoryBySlug(row.tool.category, liveCategories)
                        ? localizeCategory(categoryBySlug(row.tool.category, liveCategories)!, lang).name
                        : ''
                    }}
                  </span>
                  <span class="board__votes">
                    <Icon name="arrow-up" />{{ row.votes }}
                  </span>
                </span>
              </NuxtLink>
            </li>
          </ol>
        </section>

        <!-- Browse by category -->
        <section>
          <div class="section-head">
            <div class="section-head__title">
              <h2>{{ pick('按分类浏览', 'Browse by category') }}</h2>
            </div>
            <NuxtLink class="more" :to="localePath('/categories')">
              {{ pick('查看全部', 'View all') }}
              <Icon name="arrow-right" />
            </NuxtLink>
          </div>

          <div class="cat-grid">
            <NuxtLink
              v-for="cat in cats"
              :key="cat.slug"
              class="cat-card"
              :to="localePath(`/categories/${cat.slug}`)"
            >
              <span class="cat-card__mix" aria-hidden="true">
                <img
                  v-for="tool in cat.mix"
                  :key="tool.slug"
                  :src="`/${tool.logo}`"
                  alt=""
                  width="18"
                  height="18"
                  loading="lazy"
                >
                <span
                  v-for="n in Math.max(0, 4 - cat.mix.length)"
                  :key="`empty-${n}`"
                  class="cat-card__mix-empty"
                  aria-hidden="true"
                />
              </span>
              <span class="cat-card__body">
                <span class="cat-card__title">
                  {{ cat.name }}
                  <span class="cat-card__count">{{ cat.count }} {{ pick('个产品', 'products') }}</span>
                </span>
                <span class="cat-card__desc">{{ cat.desc }}</span>
              </span>
              <span class="cat-card__heat" :title="`${cat.votes} ${pick('票 / 本周', 'votes this week')}`">
                <span class="cat-card__bar">
                  <span :style="{ width: `${Math.round((cat.votes / maxCatVotes) * 100)}%` }" />
                </span>
                <span class="cat-card__num">{{ cat.votes }}</span>
              </span>
            </NuxtLink>
          </div>
        </section>

        <!-- Just added -->
        <section>
          <div class="section-head">
            <div class="section-head__title">
              <h2>{{ pick('最新收录', 'Just added') }}</h2>
              <p>{{ pick('目录里最近上线的产品。', 'The newest products in the directory.') }}</p>
            </div>
            <NuxtLink class="more" :to="localePath('/just-added')">
              {{ pick('查看全部', 'View all') }}
              <Icon name="arrow-right" />
            </NuxtLink>
          </div>

          <div class="tool-grid">
            <ToolCard v-for="tool in latest" :key="tool.slug" :tool="tool" />
          </div>
        </section>

        <!-- FAQ -->
        <section class="home-faq">
          <h2>{{ pick('常见问题', 'Questions') }}</h2>
          <div class="accordion">
            <div
              v-for="(item, i) in faq"
              :key="item.q"
              class="acc-item"
              :class="{ 'is-open': openFaq === i }"
            >
              <button
                class="acc-trigger"
                type="button"
                :aria-expanded="openFaq === i"
                @click="openFaq = openFaq === i ? -1 : i"
              >
                {{ item.q }}
                <Icon name="chevron-down" />
              </button>
              <div class="acc-panel">{{ item.a }}</div>
            </div>
          </div>
        </section>
      </div>

      <!-- Rail -->
      <aside class="rail">
        <AdSlot slot="sidebar" :ad="sidebarAd" />

        <RailHeat />

        <section class="paid-card">
          <div class="paid-card__preview">
            <span class="paid-card__thumb"><Icon name="sparkles" /></span>
            <span class="paid-card__pv">
              <b>{{ pick('你的产品', 'Your tool') }}</b>
              <span>{{ pick('排在免费收录之前', 'Listed above free') }}</span>
            </span>
            <span class="paid-card__flag">STANDARD</span>
          </div>
          <h2>{{ pick('让更多人先看到你', 'Get seen first') }}</h2>
          <p class="paid-card__sub">
            {{ pick('付款确认后当天上线（人工确认收款）。', 'Live the same day payment is confirmed (we confirm receipt by hand).') }}
          </p>
          <ul class="paid-feats">
            <li><Icon name="circle-check" /><span>{{ pick('永久 dofollow 反链，不挂 badge', 'Permanent dofollow link, no badge') }}</span></li>
            <li><Icon name="circle-check" /><span>{{ pick('付款确认后当天上线（人工确认收款）', 'Live the same day payment is confirmed (we confirm receipt by hand)') }}</span></li>
            <li><Icon name="circle-check" /><span>{{ pick('目录页排在免费收录之前', 'Listed above every free submission') }}</span></li>
            <li><Icon name="circle-check" /><span>{{ pick('想再往前：精选 $39 加置顶 7 天', 'Want the top? Featured adds a 7-day pin for $39') }}</span></li>
          </ul>
          <p class="paid-card__price">
            <span>{{ pick('从', 'From') }}</span><b>$19</b><em>{{ pick('一次性', 'one-time') }}</em>
          </p>
          <NuxtLink class="btn btn--primary btn--block" :to="localePath('/pricing')">
            {{ pick('升级收录', 'Upgrade your listing') }}
            <Icon name="arrow-right" />
          </NuxtLink>
        </section>

        <section>
          <div class="section-head section-head--stack">
            <div class="section-head__title">
              <h2>{{ pick('热门标签', 'Popular tags') }}</h2>
            </div>
          </div>
          <div class="tag-cloud">
            <NuxtLink
              v-for="tag in popularTags"
              :key="tag.slug"
              class="tag-pill"
              :to="localePath(`/tags/${tag.slug}`)"
            >
              #{{ localizeTag(tag, lang).name }}
            </NuxtLink>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
