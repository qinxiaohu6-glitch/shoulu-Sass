<script setup lang="ts">
/**
 * /alternatives — the launch-platform comparison page.
 *
 * Ported from the competitor's /alternatives structure: a short intro, a
 * platform comparison table, a multi-site launch plan, an FAQ and a CTA. The
 * comparison is editorial and neutral — every external platform keeps its own
 * name and link. Our own column states only what the site actually does
 * (weekly UTC board, Free + Boost, permanent page); we do not promise
 * traffic, votes or search rank on any platform.
 */
import { effectiveQuote } from '~~/shared/utils/pricing-effective'

const { pick, isZh } = useLang()
const localePath = useLocalePath()
const boostLabel = computed(() => effectiveQuote('listing', 'boost').priceLabel)

type Platform = {
  name: string
  url?: string
  rhythm: { zh: string; en: string }
  best: { zh: string; en: string }
}

const platforms: Platform[] = [
  {
    name: 'Product Atlas',
    rhythm: { zh: '每周 · UTC 周一到周日', en: 'Weekly, Monday to Sunday (UTC)' },
    best: { zh: '独立开发者、个人创始人和小团队发布 SaaS、AI 工具与副业项目', en: 'Indie makers, solo founders and small teams shipping SaaS, AI tools and side projects' },
  },
  {
    name: 'Product Hunt',
    url: 'https://www.producthunt.com/',
    rhythm: { zh: '每天 · 24 小时榜', en: 'Daily, 24-hour leaderboard' },
    best: { zh: '准备充分、首日就有受众的大型发布', en: 'Big, well-prepared launches with an audience ready on day one' },
  },
  {
    name: 'BetaList',
    url: 'https://betalist.com/',
    rhythm: { zh: '精选早期创业项目', en: 'Curated listings of early-stage startups' },
    best: { zh: '收集 beta 注册用户的发布前项目', en: 'Pre-launch startups collecting beta signups' },
  },
  {
    name: 'DevHunt',
    url: 'https://devhunt.org/',
    rhythm: { zh: '每周发布', en: 'Weekly launches' },
    best: { zh: '开发者工具与开源项目', en: 'Developer tools and open source projects' },
  },
  {
    name: 'Uneed',
    url: 'https://www.uneed.best/',
    rhythm: { zh: '每天发布，需排队', en: 'Daily launches with a waiting line' },
    best: { zh: '想要每日发布并进入工具目录的开发者', en: 'Makers who want a daily launch and a tools directory listing' },
  },
  {
    name: 'Peerlist Launchpad',
    url: 'https://peerlist.io/launchpad',
    rhythm: { zh: '面向 Peerlist 成员的每周发布', en: 'Weekly launches for Peerlist members' },
    best: { zh: '已经把 Peerlist 当作品集的开发者', en: 'Builders who already use Peerlist as their profile' },
  },
  {
    name: 'Fazier',
    url: 'https://fazier.com/',
    rhythm: { zh: '每天发布', en: 'Daily launches' },
    best: { zh: '想再找一个每日发布渠道的独立开发者', en: 'Indie makers looking for another daily launch spot' },
  },
  {
    name: 'Microlaunch',
    url: 'https://microlaunch.net/',
    rhythm: { zh: '更长的发布周期', en: 'Longer launch periods' },
    best: { zh: '想要更长时间收集反馈的开发者', en: 'Makers who want feedback over a longer window' },
  },
  {
    name: 'Show HN (Hacker News)',
    url: 'https://news.ycombinator.com/',
    rhythm: { zh: '持续发帖，几小时内升降', en: 'Continuous, posts rise and fall within hours' },
    best: { zh: '经得起直接、尖锐讨论的技术产品', en: 'Technical products that can survive a sharp, honest crowd' },
  },
]

const planSteps = computed(() => [
  {
    n: '1',
    zh: '在本站选一个发布周，用七天收集投票和反馈。',
    en: 'Pick a launch week here and collect votes and feedback for seven days.',
  },
  {
    n: '2',
    zh: '再去与你的受众匹配的垂直站发布（开发者工具去 DevHunt，发布前去 BetaList）。',
    en: 'Post on a niche site that matches your audience (DevHunt for developer tools, BetaList for pre-launch).',
  },
  {
    n: '3',
    zh: '技术产品可以再发一条 Show HN。保持诚实、简短。',
    en: 'Share a Show HN post if your product is technical. Keep it honest and short.',
  },
  {
    n: '4',
    zh: '最后再去 Product Hunt，带着你的徽章、早期评价和已准备好的支持者名单。',
    en: 'Go to Product Hunt last, with your badge, early reviews and a list of supporters ready.',
  },
])

const faq = computed(() => [
  {
    q: { zh: '最好的 Product Hunt 替代品是什么？', en: 'What is the best Product Hunt alternative?' },
    a: {
      zh: '取决于你的产品。对独立开发者和小团队，本周榜这样的每周榜单比单日竞赛给发布更多时间、竞争更小。开发者工具可以选 DevHunt 和 Show HN；发布前项目适合 BetaList。',
      en: 'It depends on your product. For indie makers and small teams, a weekly board like ours gives a launch more time and less competition than a single day. For developer tools, DevHunt and Show HN are strong picks. For pre-launch startups, BetaList is a good fit.',
    },
  },
  {
    q: { zh: '我该在哪里发布我的创业项目？', en: 'Where should I launch my startup?' },
    a: {
      zh: '分散在几周、几个站发布：先上一个每周榜单，再选一个与受众匹配的垂直站，技术产品发 Show HN，等你有了愿意支持你的受众再去 Product Hunt。',
      en: 'Launch on several sites, spread over a few weeks: a weekly board, a niche site for your audience, Show HN if your product is technical, and Product Hunt when you have an audience ready to support you.',
    },
  },
  {
    q: { zh: '发布站对 SEO 有帮助吗？', en: 'Do launch sites help SEO?' },
    a: {
      zh: '可能有。每次发布都会得到一个指向你网站的产品页。本站的付费收录是 dofollow 链接，免费收录是 nofollow；每个产品页都可以被搜索引擎收录。我们不承诺任何排名、流量或权重提升。',
      en: 'They can. Each launch gives you a product page that links to your website. Paid listings here are dofollow; free ones are nofollow; every product page can be indexed. We do not promise any ranking, traffic or domain-authority outcome.',
    },
  },
  {
    q: { zh: '怎么给发布争取更多点赞？', en: 'How do I get more upvotes on a launch?' },
    a: {
      zh: '发布前先准备：清楚的标语、好看的 logo、一句话说明你服务谁，以及一份要通知的人的名单。把发布页发到 X、LinkedIn、Reddit 和你的邮件列表，并回复每一条评论。',
      en: 'Prepare before launch day: a clear tagline, a good logo, a short description of who it is for, and a list of people to tell. Share your launch page on X, LinkedIn, Reddit and your newsletter, and reply to every comment.',
    },
  },
])

const openFaq = ref<number | null>(null)

useSeo({
  title: computed(() =>
    pick('Product Hunt 替代品与发布平台对比 · Product Atlas', 'Product Hunt alternatives & launch platforms · Product Atlas'),
  ),
  description: computed(() =>
    pick(
      '对比主流产品发布平台的发布节奏与适合人群，以及如何用每周榜单做多站点发布。',
      'Compare launch platforms by rhythm and best fit, and how to run a multi-site launch with a weekly board.',
    ),
  ),
})
</script>

<template>
  <div class="container alt-page">
    <nav class="breadcrumb" :aria-label="pick('面包屑', 'breadcrumb')">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" :size="14" />
      <span>{{ pick('发布平台对比', 'Launch platforms') }}</span>
    </nav>

    <header class="alt-head">
      <p class="alt-kicker">{{ pick('发布平台', 'LAUNCH PLATFORMS') }}</p>
      <h1>{{ pick('Product Hunt 替代品', 'Product Hunt alternatives') }}</h1>
      <p class="alt-lead">
        {{
          pick(
            '发布创业项目、SaaS 或副业项目的最佳去处，以及本站的对比。',
            'The best places to launch a startup, SaaS or side project, and how this site compares.',
          )
        }}
      </p>
      <p class="alt-note">
        {{
          pick(
            'Product Hunt 最出名，但 24 小时竞赛不是唯一的发布方式。每周榜单、垂直目录和社区也能带来投票、反馈和曝光，而且竞争往往更小。下面是主要平台如何比较。',
            'Product Hunt is the best-known launch site, but one 24-hour race is not the only way to launch. Weekly boards, niche directories and communities can bring you votes, feedback and traffic too, often with less competition. Here is how the main options compare.',
          )
        }}
      </p>
    </header>

    <section class="alt-table-wrap" aria-labelledby="alt-compare-title">
      <h2 id="alt-compare-title" class="alt-h2">{{ pick('平台对比', 'Compare platforms') }}</h2>
      <div class="alt-table-scroll">
        <table class="alt-table">
          <thead>
            <tr>
              <th scope="col">{{ pick('平台', 'Platform') }}</th>
              <th scope="col">{{ pick('发布节奏', 'Launch rhythm') }}</th>
              <th scope="col">{{ pick('适合', 'Best for') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in platforms" :key="p.name" :class="{ 'is-ours': i === 0 }">
              <th scope="row">
                <NuxtLink v-if="i === 0" :to="localePath('/')">{{ p.name }}</NuxtLink>
                <a v-else :href="p.url ?? '#'" target="_blank" rel="noopener">{{ p.name }}</a>
              </th>
              <td>{{ isZh ? p.rhythm.zh : p.rhythm.en }}</td>
              <td>{{ isZh ? p.best.zh : p.best.en }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="alt-plan" aria-labelledby="alt-plan-title">
      <h2 id="alt-plan-title" class="alt-h2">{{ pick('一个简单的多站点发布计划', 'A simple multi-site launch plan') }}</h2>
      <ol class="alt-steps">
        <li v-for="step in planSteps" :key="step.n">
          <span class="alt-steps__n">{{ step.n }}</span>
          <p>{{ isZh ? step.zh : step.en }}</p>
        </li>
      </ol>
    </section>

    <section class="alt-cards" aria-labelledby="alt-cards-title">
      <h2 id="alt-cards-title" class="alt-h2">{{ pick('更多发布平台', 'More launch platforms') }}</h2>
      <div class="alt-card-grid">
        <a
          v-for="(p, i) in platforms.slice(1)"
          :key="p.name"
          class="alt-card"
          :href="p.url ?? '#'"
          target="_blank"
          rel="noopener"
        >
          <strong>{{ p.name }} {{ pick('替代品', 'alternative') }}</strong>
          <span>{{ isZh ? p.rhythm.zh : p.rhythm.en }}</span>
        </a>
      </div>
    </section>

    <section class="alt-faq" aria-labelledby="alt-faq-title">
      <h2 id="alt-faq-title" class="alt-h2">{{ pick('开发者常问的问题', 'Questions makers ask') }}</h2>
      <div class="alt-faq__list">
        <article v-for="(item, i) in faq" :key="item.q.en" class="alt-faq__item">
          <h3>
            <button type="button" :aria-expanded="openFaq === i" @click="openFaq = openFaq === i ? null : i">
              {{ isZh ? item.q.zh : item.q.en }}
              <Icon name="chevron-down" :size="18" :class="{ 'is-open': openFaq === i }" />
            </button>
          </h3>
          <p v-if="openFaq === i">{{ isZh ? item.a.zh : item.a.en }}</p>
        </article>
      </div>
    </section>

    <section class="alt-cta">
      <h2>{{ pick('本周就发布你的产品', 'Launch your product this week') }}</h2>
      <p>
        {{
          pick(
            `免费发布，或付 ${boostLabel} 加速 —— 得到金色认证徽章和永久 dofollow 反链。`,
            `Launch free, or Boost for ${boostLabel} for a verified badge and a dofollow backlink.`,
          )
        }}
      </p>
      <div class="alt-cta__btns">
        <NuxtLink class="btn btn--primary" :to="localePath('/submit')">
          {{ pick('提交产品', 'Submit a product') }}
        </NuxtLink>
        <NuxtLink class="btn btn--outline" :to="localePath('/pricing')">
          {{ pick('查看定价', 'See pricing') }}
        </NuxtLink>
      </div>
    </section>

    <p class="alt-footnote">
      {{
        pick(
          '产品名称归各自所有者。其他平台的资料为一般性描述，可能变化；请以它们官网的当前规则与价格为准。',
          'Product names belong to their owners. Details about other platforms are general and can change; check their sites for current rules and prices.',
        )
      }}
    </p>
  </div>
</template>

<style scoped>
.alt-page { padding-top: 28px; padding-bottom: 60px; }
.alt-head { max-width: 760px; margin: 10px 0 32px; }
.alt-kicker { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.12em; color: #b45309; }
.alt-head h1 { margin: 8px 0 12px; font-size: 34px; letter-spacing: -0.03em; }
.alt-lead { margin: 0 0 10px; font-size: 18px; line-height: 1.5; color: var(--foreground); }
.alt-note { margin: 0; font-size: 14px; line-height: 1.7; color: var(--muted-foreground); }
.alt-h2 { margin: 36px 0 16px; font-size: 24px; letter-spacing: -0.02em; }
.alt-table-scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: 14px; }
.alt-table { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 14px; }
.alt-table th, .alt-table td { padding: 12px 14px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--border); }
.alt-table thead th { font-size: 12px; letter-spacing: 0.04em; color: var(--muted-foreground); background: var(--muted, #f6f6f4); }
.alt-table tbody tr:last-child th, .alt-table tbody tr:last-child td { border-bottom: 0; }
.alt-table tbody th { font-weight: 700; }
.alt-table a { color: inherit; text-decoration: none; }
.alt-table a:hover { color: #b45309; text-decoration: underline; }
.alt-table tr.is-ours { background: #fff8e8; }
.alt-table tr.is-ours th a { color: #b45309; }
.alt-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; counter-reset: none; }
.alt-steps li { display: flex; gap: 14px; align-items: flex-start; padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); }
.alt-steps__n { flex: none; width: 28px; height: 28px; border-radius: 50%; background: #14161a; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; }
.alt-steps p { margin: 2px 0 0; font-size: 14px; line-height: 1.6; }
.alt-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.alt-card { display: flex; flex-direction: column; gap: 6px; padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--card); text-decoration: none; color: inherit; }
.alt-card:hover { border-color: #d9a03a; }
.alt-card strong { font-size: 15px; }
.alt-card span { font-size: 13px; color: var(--muted-foreground); }
.alt-faq__list { border-top: 1px solid var(--border); }
.alt-faq__item { border-bottom: 1px solid var(--border); }
.alt-faq__item h3 { margin: 0; }
.alt-faq__item button { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 0; font-size: 15px; font-weight: 600; text-align: left; background: none; border: 0; cursor: pointer; color: inherit; }
.alt-faq__item button :deep(svg) { width: 18px; height: 18px; flex: none; transition: transform .15s; }
.alt-faq__item button :deep(svg.is-open) { transform: rotate(180deg); }
.alt-faq__item p { margin: 0 0 16px; font-size: 14px; line-height: 1.7; color: var(--muted-foreground); }
.alt-cta { margin-top: 40px; padding: 28px; border-radius: 18px; background: #fff7e6; border: 1px solid #f0d48a; }
.alt-cta h2 { margin: 0 0 8px; font-size: 26px; letter-spacing: -0.02em; }
.alt-cta p { margin: 0 0 18px; font-size: 14px; color: #6b531f; }
.alt-cta__btns { display: flex; flex-wrap: wrap; gap: 10px; }
.alt-footnote { margin-top: 26px; font-size: 12px; line-height: 1.6; color: var(--muted-foreground); }
@media (max-width: 640px) {
  .alt-head h1 { font-size: 28px; }
}
</style>
