<script setup lang="ts">
const { isZh, lang, pick } = useLang()
const localePath = useLocalePath()

/**
 * The shape of `/api/audit` and `/api/dr`, mirrored from `server/utils/audit.ts`.
 *
 * Declared as interfaces rather than inferred from the response so the
 * template cannot quietly start rendering a field the server stopped sending.
 */
type CheckStatus = 'pass' | 'warn' | 'fail'

interface AuditCheck {
  id: string
  group: string
  label: string
  status: CheckStatus
  detail: string
  fix: string
}

interface AuditGroup {
  key: string
  label_zh: string
  label_en: string
  score: number
  max: number
  count: number
}

interface AuditReport {
  ok: true
  /**
   * Which rubric produced this score. Bumped whenever the check set changes, so
   * a screenshot of "84 B" taken today is not silently compared to one taken
   * against 20 checks last month.
   */
  rubric?: number
  url: string
  final_url: string
  status: number
  score: number
  grade: string
  groups: AuditGroup[]
  checks: AuditCheck[]
  summary: { pass: number; warn: number; fail: number }
  title: string
}

const url = ref('')

const report = ref<AuditReport | null>(null)
const auditBusy = ref(false)
const pdfBusy = ref(false)
const status = ref('')
const statusKind = ref<'info' | 'error'>('info')

/** `$fetch` throws on 4xx/5xx; the body is still the JSON contract. */
function errorBody(err: unknown) {
  return (err as { data?: { message_zh?: string; message_en?: string; upstream_status?: number } })?.data
}

async function runAudit() {
  if (auditBusy.value) return

  const raw = url.value.trim()
  if (!raw) {
    statusKind.value = 'error'
    status.value = pick('先填一个网址。', 'Enter a URL first.')
    return
  }

  auditBusy.value = true
  report.value = null
  statusKind.value = 'info'
  status.value = pick('正在抓取页面并检查…', 'Fetching the page and running the checks…')

  // Four outbound fetches can take a while; saying so beats a dead button.
  const slow = setTimeout(() => {
    status.value = pick('这个站响应有点慢，再等等…', 'That site is slow. Still waiting…')
  }, 9000)

  try {
    report.value = await $fetch<AuditReport>('/api/audit', {
      method: 'POST',
      body: { url: raw, lang: lang.value },
    })
    status.value = ''
  } catch (err) {
    const data = errorBody(err)
    const base = isZh.value ? data?.message_zh : data?.message_en
    statusKind.value = 'error'
    status.value = base
      ? data?.upstream_status
        ? `${base} (HTTP ${data.upstream_status})`
        : base
      : pick('诊断服务暂时不可用，请稍后再试。', 'The check service is unavailable right now — please try again later.')
  } finally {
    clearTimeout(slow)
    auditBusy.value = false
  }
}

/**
 * `withCompare` is opt-in. Vue passes the event object to a bare `@submit`
 * handler, so every call site passes an explicit argument — otherwise a form
 * submit would arrive here as a truthy object and silently double the number
 * of upstream calls.
 */
async function downloadPdf() {
  if (!report.value || pdfBusy.value) return
  pdfBusy.value = true
  statusKind.value = 'info'
  status.value = pick('正在生成 PDF…', 'Building the PDF…')
  try {
    const res = await fetch('/api/audit/pdf', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: report.value.final_url || url.value, lang: lang.value }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message_zh?: string; message_en?: string } | null
      statusKind.value = 'error'
      status.value = (isZh.value ? data?.message_zh : data?.message_en)
        || pick('这次没有生成 PDF。', 'No PDF was created for this check.')
      return
    }
    const blob = await res.blob()
    if (!blob.size || blob.type.includes('json')) {
      statusKind.value = 'error'
      status.value = pick('这次没有生成 PDF。', 'No PDF was created for this check.')
      return
    }
    const match = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')
    const name = match?.[1] || 'dirtool-seo-report.pdf'
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = name
    link.click()
    URL.revokeObjectURL(href)
    status.value = ''
  } catch {
    statusKind.value = 'error'
    status.value = pick('PDF 没有下载成功，请再试一次。', 'The PDF did not download. Try again.')
  } finally {
    pdfBusy.value = false
  }
}

/* ------------------------------------------------------------- report view */

const targetLabel = computed(() => (report.value?.final_url || '').replace(/^https?:\/\//, ''))

const verdict = computed(() => {
  const score = report.value?.score ?? 0
  if (score >= 85) return pick('技术底子已经很扎实', 'Technically solid')
  if (score >= 60) return pick('能用，但有几处在拖后腿', 'Workable, with a few leaks')
  return pick('先修这几项，再谈排名', 'Fix these before chasing rankings')
})

const fixes = computed(() => {
  const checks = report.value?.checks ?? []
  const fails = checks.filter((c) => c.status === 'fail')
  const warns = checks.filter((c) => c.status === 'warn')
  // Five is about what anyone will act on in one sitting; the full list is one
  // click away in the details block below.
  return fails.concat(warns).slice(0, 5)
})

const hasFails = computed(() => (report.value?.checks ?? []).some((c) => c.status === 'fail'))

const grouped = computed(() =>
  (report.value?.groups ?? []).map((g) => ({
    ...g,
    items: (report.value?.checks ?? []).filter((c) => c.group === g.key),
  })),
)

const submitHref = computed(() => {
  const target = report.value?.final_url || ''
  return `${localePath('/submit')}?url=${encodeURIComponent(target)}`
})

const statusIcon = (s: CheckStatus) => (s === 'pass' ? '✓' : s === 'warn' ? '!' : '×')

const dims = computed(() => [
  {
    n: '01',
    title: pick('标题与描述', 'Title & description'),
    body: pick(
      '标题决定点击率，描述决定要不要点。两个都缺，搜索引擎只能自己编一段。',
      'The title wins the click, the description decides whether there is one. Missing both, a search engine writes its own.',
    ),
  },
  {
    n: '02',
    title: pick('结构化数据', 'Structured data'),
    body: pick(
      'JSON-LD 说清这是什么、多少钱、谁做的。光有标签不够——Product 缺 offers、Article 缺 author，照样出不了富媒体结果。',
      'JSON-LD states what this is, what it costs, who made it. The tag alone is not enough: a Product without offers or an Article without an author produces no rich result.',
    ),
  },
  {
    n: '03',
    title: pick('AI 可读性', 'AI readability'),
    body: pick(
      'AI 搜索读的是纯文本，也要你放行它的爬虫。注意：OAI-SearchBot 决定 ChatGPT 能不能引用你，GPTBot 只管训练——挡错一个，等于白做。',
      'AI search reads plain text and needs your permission to fetch it. Note: OAI-SearchBot governs whether ChatGPT can cite you; GPTBot only governs training — block the wrong one and the work is wasted.',
    ),
  },
  {
    n: '04',
    title: pick('抓取与索引', 'Crawl & index'),
    body: pick(
      'canonical、robots.txt、sitemap、noindex、hreflang。任何一项配错，页面做得再好也进不了索引。',
      'Canonical, robots.txt, sitemap, noindex, hreflang. Get one wrong and a beautiful page never enters the index.',
    ),
  },
  {
    n: '05',
    title: pick('内容与关键词', 'Content & keywords'),
    body: pick(
      '300 词以上、用 H2 分节、列表和表格、图片有 alt 与宽高、有内链。这是能不能排上去的地基。',
      '300+ words, H2 sections, lists and tables, image alt text and dimensions, internal links. This is the floor you rank from.',
    ),
  },
])

const faq = computed(() => [
  {
    q: pick('这个分数等于 Google 排名吗？', 'Is this score my Google ranking?'),
    a: pick(
      '不等于。这 28 项是技术底子：做对了才「有机会」被收录、被引用；做不对基本没机会。排名还看外链、内容质量、搜索意图，那些这项工具不测。',
      'No. These 28 checks are the technical floor: get them right and you have a chance to be indexed and cited; get them wrong and you mostly do not. Ranking also depends on links, content quality and search intent, which this tool does not measure.',
    ),
  },
  {
    q: pick('分数是怎么算出来的？', 'How is the score calculated?'),
    a: pick(
      '28 项分在 5 个维度里。每项按通过记 1 分、待改进记 0.5 分、不通过记 0 分，再把每个维度折算成 20 分，五个维度相加就是满分 100。所以「AI 可读性」有 7 项，也不会因为项多就比 4 项的「标题与描述」占更多分。',
      'The 28 checks sit in five areas. Each scores 1 for pass, 0.5 for needs work, 0 for fail; every area is then scaled to 20 points, and the five areas add up to 100. So AI readability, with 7 checks, does not outweigh title and description just for having more of them.',
    ),
  },
  {
    q: pick('为什么我分数不低，还是没流量？', 'My score is decent but I still get no traffic. Why?'),
    a: pick(
      '技术合格只是入场券。分数高说明机器读得懂你的页面，但有没有人搜、搜了会不会点，取决于关键词选择和页面本身的说服力。',
      'Technical health is the entry ticket. A high score means machines can read your page; whether anyone searches for it, and clicks, depends on keyword choice and how convincing the page is.',
    ),
  },
  {
    q: pick('诊断完可以直接提交收录吗？', 'Can I submit my product right after the check?'),
    a: pick(
      '可以。提交时带上刚才诊断的链接，我们会自动抓取标题、描述和图标，你只需要确认。',
      'Yes. Submit with the URL you just checked and we prefill the title, description and icon — you only confirm.',
    ),
  },
  {
    q: pick('你们会不会保存我查过的网址？', 'Do you store the URLs I check?'),
    a: pick(
      '不会存进数据库，也没有账号体系。结果只在这次请求里生成，刷新就没了。下载的 PDF 同样不入库，封面和每一页都带 https://dirtool.com。',
      'No database, no account. The report is built for that one request and disappears on refresh. The downloaded PDF is not stored either, and every page carries https://dirtool.com.',
    ),
  },
])

const openFaq = ref(-1)

useSeo({
  title: computed(() =>
    isZh.value
      ? 'SEO 诊断 · 粘一个链接，10 秒看完 28 项检查 · Product Atlas'
      : 'SEO check · paste a link, get 28 checks in about 10 seconds · Product Atlas',
  ),
  description: computed(() =>
    isZh.value
      ? '不注册、不装插件。我们像爬虫一样抓取你的页面，检查标题、结构化数据、AI 可读性、抓取索引和内容，然后告诉你先改哪几项。'
      : 'No signup, no plugin. We fetch your page the way a crawler does, check title, structured data, AI readability, crawlability and content, then tell you what to fix first.',
  ),
})
</script>

<template>
  <div class="container container--narrow">
    <nav class="breadcrumb" aria-label="breadcrumb">
      <NuxtLink :to="localePath('/')">{{ pick('发现', 'Discover') }}</NuxtLink>
      <Icon name="chevron-right" />
      <span>{{ pick('SEO 诊断', 'SEO check') }}</span>
    </nav>

    <header class="page-head tool-head">
      <p class="tool-eyebrow">
        <Icon name="gauge" />{{ pick('免费工具 · 无需注册', 'Free tool · no signup') }}
      </p>
      <h1 class="page-title page-title--lg">
        {{ isZh
          ? 'SEO 诊断：粘一个链接，10 秒看完 28 项检查'
          : 'SEO check: paste a link, get 28 checks in about 10 seconds' }}
      </h1>
      <p class="page-sub page-sub--lg">
        {{ isZh
          ? '不注册、不装插件、不改你的站。我们会像爬虫一样真的抓取你的页面，检查标题、结构化数据、AI 可读性、抓取索引和内容，然后告诉你先改哪几项。'
          : 'No signup, no plugin, nothing to install. We fetch your page the way a crawler does, check title, structured data, AI readability, crawlability and content — then tell you which few things to fix first.' }}
      </p>
    </header>

    <section class="tool-panel" :aria-label="pick('SEO 诊断', 'SEO check')">
      <form class="tool-form" novalidate @submit.prevent="runAudit">
        <div class="tool-form__field">
          <span class="tool-form__ico"><Icon name="link" /></span>
          <input
            v-model="url"
            name="url"
            type="text"
            inputmode="url"
            autocomplete="url"
            spellcheck="false"
            placeholder="https://your-product.com"
            :aria-label="pick('要检测的网址', 'URL to check')"
          >
        </div>
        <button class="btn btn--primary btn--lg" type="submit" :disabled="auditBusy">
          <span>{{ auditBusy ? pick('诊断中…', 'Checking…') : pick('开始诊断', 'Run the check') }}</span><Icon name="arrow-right" />
        </button>
      </form>

      <p class="tool-note">
        <Icon name="shield-check" />
        <span>{{ isZh
          ? '只读取公开页面，不需要登录或授权。抓不到就是抓不到，我们不会编一份结果。'
          : 'We read the public page only — no login, no access. If we cannot fetch it, we say so instead of inventing a report.' }}</span>
      </p>

      <p class="tool-status" :class="{ 'is-error': statusKind === 'error' }" role="status" aria-live="polite">{{ status }}</p>

      <!-- The report is rendered inline rather than on a second page: the
           visitor already typed the URL, and a permalink would mean storing it,
           which the FAQ further down promises we do not do. -->
      <div v-if="report" class="audit">
        <div class="audit__head">
          <div class="audit__ring" :data-grade="report.grade" :style="{ '--pct': report.score }">
            <div class="audit__ring-in">
              <b>{{ report.score }}</b><span>/100</span>
            </div>
          </div>
          <div class="audit__verdict">
            <p class="audit__kicker">
              {{ pick('检测对象', 'Checked') }} ·
              <a :href="report.final_url" target="_blank" rel="noopener nofollow">{{ targetLabel }}</a>
            </p>
            <h2 class="audit__headline">{{ verdict }}</h2>
            <ul class="audit__tally">
              <li v-if="report.summary.fail" class="is-fail">
                <b>{{ report.summary.fail }}</b>{{ pick('项不通过', 'failed') }}
              </li>
              <li v-if="report.summary.warn" class="is-warn">
                <b>{{ report.summary.warn }}</b>{{ pick('项待改进', 'to improve') }}
              </li>
              <li v-if="report.summary.pass" class="is-pass">
                <b>{{ report.summary.pass }}</b>{{ pick('项通过', 'passed') }}
              </li>
            </ul>
          </div>
          <button class="btn btn--primary btn--lg audit__download" type="button" :disabled="pdfBusy" @click="downloadPdf">
            {{ pdfBusy ? pick('正在生成 PDF…', 'Building the PDF…') : pick('下载 PDF', 'Download PDF') }}
          </button>
        </div>

        <div class="audit__bars">
          <div v-for="g in report.groups" :key="g.key" class="g-row">
            <span class="g-row__label">{{ isZh ? g.label_zh : g.label_en }}</span>
            <span class="g-row__bar"><i :style="{ width: `${Math.round((g.score / g.max) * 100)}%` }" /></span>
            <span class="g-row__score">{{ g.score }}<span>/{{ g.max }}</span></span>
          </div>
        </div>

        <div v-if="fixes.length" class="audit__fixes">
          <h3>
            {{ hasFails ? pick('先修这几项', 'Fix these first') : pick('可以再优化这几项', 'Worth improving') }}
            <span>{{ fixes.length }}</span>
          </h3>
          <ol>
            <li v-for="c in fixes" :key="c.id" class="fix" :class="`fix--${c.status}`">
              <span class="fix__tag">{{ c.status === 'fail' ? pick('必改', 'Must fix') : pick('建议', 'Worth fixing') }}</span>
              <div>
                <p class="fix__label">{{ c.label }}</p>
                <p class="fix__detail">{{ c.detail }}</p>
                <p v-if="c.fix" class="fix__how">{{ c.fix }}</p>
              </div>
            </li>
          </ol>
        </div>
        <div v-else class="audit__fixes is-clean">
          <h3>{{ pick('没有需要修的地方', 'Nothing to fix') }}</h3>
          <p>{{ pick('这 28 项全部通过或接近通过。', 'All 28 checks pass or nearly pass.') }}</p>
        </div>

        <details class="audit__all">
          <summary>{{ pick('全部检查明细', 'All checks') }} <span>{{ report.checks.length }}</span></summary>
          <div class="chk-groups">
            <section v-for="g in grouped" :key="g.key" class="chk-group">
              <h4>{{ isZh ? g.label_zh : g.label_en }}<span>{{ g.score }}/{{ g.max }}</span></h4>
              <ul>
                <li v-for="c in g.items" :key="c.id" class="chk" :class="`chk--${c.status}`">
                  <span class="chk__dot" aria-hidden="true">{{ statusIcon(c.status) }}</span>
                  <div class="chk__body">
                    <p class="chk__label">{{ c.label }}</p>
                    <p class="chk__detail">{{ c.detail }}</p>
                    <p v-if="c.fix" class="chk__how">
                      {{ pick('怎么改', 'How to fix') }}{{ isZh ? '：' : ': ' }}{{ c.fix }}
                    </p>
                  </div>
                </li>
              </ul>
            </section>
          </div>
          <p class="chk-foot">
            {{ pick(
              `评分口径 v${report.rubric ?? 1} · 共 ${report.checks.length} 项检查`,
              `Rubric v${report.rubric ?? 1} · ${report.checks.length} checks total`,
            ) }}
          </p>
        </details>

        <div class="audit__cta">
          <div>
            <p class="audit__cta-title">
              {{ pick('把这条链接直接提交，资料自动填好。', 'Submit this URL and the listing is prefilled.') }}
            </p>
            <p class="audit__cta-note">{{ pick('免费收录，页面永久保留。', 'Free to list. The page stays.') }}</p>
          </div>
          <NuxtLink class="btn btn--primary" :to="submitHref">
            {{ pick('提交这个产品', 'Submit this product') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="tool-section">
      <div class="section-head">
        <div class="section-head__title">
          <h2>{{ pick('28 项检查，5 个维度', '28 checks, five areas') }}</h2>
          <p>{{ pick('每项记 1 / 0.5 / 0 分，按维度折算成 20 分。', 'Each check scores 1 / 0.5 / 0, scaled to 20 per area.') }}</p>
        </div>
      </div>
      <div class="dim-grid">
        <article v-for="dim in dims" :key="dim.n" class="dim-card">
          <span class="dim-card__n">{{ dim.n }}</span>
          <h3>{{ dim.title }}</h3>
          <p>{{ dim.body }}</p>
        </article>
      </div>
    </section>

    <section id="dr" class="tool-section">
      <div class="section-head">
        <div class="section-head__title">
          <h2>{{ pick('Domain Rating（DR4）', 'Domain Rating (DR4)') }}</h2>
          <p>{{
            pick(
              'DR 查询已单独成页。这里只保留入口，数字仍来自 Ahrefs 官方免费接口。',
              'The DR lookup has its own page. This is the entrance. The number still comes from the official free Ahrefs endpoint.',
            )
          }}</p>
        </div>
      </div>
      <NuxtLink class="btn btn--outline" :to="localePath('/tools/dr-checker')">
        {{ pick('打开 DR 查询', 'Open DR checker') }}
      </NuxtLink>
    </section>

    <section class="tool-section">
      <div class="section-head">
        <div class="section-head__title">
          <h2>{{ pick('常见问题', 'Questions') }}</h2>
        </div>
      </div>
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

    <section class="tool-cta">
      <div class="tool-cta__body">
        <h2>{{ pick('诊断完，把产品提交上来', 'Checked it? Now list the product.') }}</h2>
        <p>{{ isZh
          ? '免费收录，页面永久保留；付费置顶拿 dofollow 反链。提交时带上你刚查的链接，资料自动填好。'
          : 'Free to list, the page stays. A paid placement adds a dofollow backlink. Submit with the URL you just checked and the listing is prefilled.' }}</p>
      </div>
      <NuxtLink class="btn btn--primary btn--lg" :to="localePath('/submit')">
        {{ pick('提交产品', 'Submit a product') }}<Icon name="arrow-right" />
      </NuxtLink>
    </section>
  </div>
</template>
