/**
 * The PDF outline for one SEO check.
 *
 * Built from the audit result the server just computed. Nothing here is stored.
 * Domain Rating is not part of this report. The only dirtool.com paths are the
 * checker, submit, and pricing — no unreleased tool routes.
 */

export const BRAND_NAME = 'Product Atlas'
export const BRAND_URL = 'https://dirtool.com'
export const BRAND_FOOTER = `© ${BRAND_NAME} · ${BRAND_URL}`

export type SeoReportLang = 'zh' | 'en'

export type SeoCheckStatus = 'pass' | 'warn' | 'fail'

export type SeoReportInput = {
  rubric?: number
  final_url: string
  score: number
  grade: string
  title?: string
  groups: { key: string; label_zh: string; label_en: string; score: number; max: number }[]
  checks: { id: string; group: string; label: string; status: SeoCheckStatus; detail: string; fix: string }[]
  summary: { pass: number; warn: number; fail: number }
}

export type SeoReportLink = { label: string; url: string }

export type SeoReport = {
  lang: SeoReportLang
  filename: string
  footer: string
  cover: {
    kicker: string
    title: string
    scoreLine: string
    checked: string
    generated: string
    rubric: string
    brand: string
    pitch: string
  }
  summaryTitle: string
  verdict: string
  tally: string
  fixesTitle: string
  fixes: { tag: string; label: string; detail: string; how: string }[]
  areasTitle: string
  areas: { label: string; score: number; max: number }[]
  checksTitle: string
  checks: { group: string; status: string; label: string; detail: string; how: string }[]
  disclaimerTitle: string
  disclaimer: string[]
  nextTitle: string
  next: SeoReportLink[]
}

const COPY = {
  en: {
    kicker: 'Product Atlas · SEO Check Report',
    title: 'SEO check report',
    score: (n: number, grade: string) => `Score ${n}/100 · Grade ${grade}`,
    checked: (url: string) => `Checked: ${url}`,
    generated: (when: string) => `Generated: ${when} Asia/Shanghai`,
    rubric: (n: number) => `Rubric v${n}`,
    brand: `Report by ${BRAND_URL}`,
    pitch: 'Free SEO check. List your product on dirtool.com.',
    summary: '1. Executive summary',
    solid: 'The technical floor is in good shape.',
    mid: 'Workable, with a few leaks to close.',
    weak: 'Fix the failed checks before chasing rankings.',
    tally: (p: number, w: number, f: number) => `${p} passed · ${w} to improve · ${f} failed`,
    fixes: '2. Fix these first',
    must: 'Must fix',
    worth: 'Worth fixing',
    how: 'How',
    areas: '3. Five areas',
    all: '4. All checks',
    pass: 'Pass',
    warn: 'Needs work',
    fail: 'Fail',
    disclaimerTitle: '5. What this score is not',
    disclaimer: [
      'This is not a Google ranking and not a traffic promise.',
      'The check reads one public page. It does not measure links, keywords, or Core Web Vitals.',
      'A failed fetch does not become a perfect score.',
    ],
    next: '6. Next on dirtool.com',
    rerun: 'Re-run the check',
    submit: 'Submit this product',
    pricing: 'See pricing',
    tools: 'Tools',
    dr: 'Domain Rating checker',
  },
  zh: {
    kicker: 'Product Atlas · SEO 诊断报告',
    title: 'SEO 诊断报告',
    score: (n: number, grade: string) => `分数 ${n}/100 · 等级 ${grade}`,
    checked: (url: string) => `检测对象：${url}`,
    generated: (when: string) => `生成时间：${when}（上海时间）`,
    rubric: (n: number) => `评分口径 v${n}`,
    brand: `报告来自 ${BRAND_URL}`,
    pitch: '免费 SEO 诊断。在 dirtool.com 提交你的产品。',
    summary: '1. 结论',
    solid: '技术底子已经比较扎实。',
    mid: '能用，但有几处在拖后腿。',
    weak: '先修不通过的项，再谈排名。',
    tally: (p: number, w: number, f: number) => `${p} 项通过 · ${w} 项待改进 · ${f} 项不通过`,
    fixes: '2. 先修这几项',
    must: '必改',
    worth: '建议',
    how: '怎么改',
    areas: '3. 五个维度',
    all: '4. 全部检查',
    pass: '通过',
    warn: '待改进',
    fail: '不通过',
    disclaimerTitle: '5. 这个分数不是什么',
    disclaimer: [
      '这不是 Google 排名，也不承诺流量。',
      '只读取一个公开页面。不测外链、关键词量，也不测 Core Web Vitals。',
      '页面抓不到时不会生成满分报告。',
    ],
    next: '6. 下一步 · dirtool.com',
    rerun: '再跑一次诊断',
    submit: '提交这个产品',
    pricing: '查看定价',
    tools: '工具',
    dr: 'Domain Rating 查询',
  },
} as const

export function shanghaiStamp(when = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(fmt.formatToParts(when).map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

export function seoPdfFilename(finalUrl: string, when = new Date()): string {
  let host = 'site'
  try {
    host = new URL(finalUrl).hostname.replace(/^www\./i, '')
  } catch {
    host = 'site'
  }
  const safe = host.toLowerCase().replace(/[^a-z0-9.-]+/g, '').replace(/^\.+|\.+$/g, '').slice(0, 80) || 'site'
  const day = shanghaiStamp(when).slice(0, 10)
  return `dirtool-seo-${safe}-${day}.pdf`
}

function clip(value: string, max = 500): string {
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Three existing pages. No DR number and no unreleased tool route. */
export function seoReportLinks(finalUrl: string, lang: SeoReportLang): SeoReportLink[] {
  const copy = COPY[lang]
  const submit = `${BRAND_URL}/submit?url=${encodeURIComponent(finalUrl)}`
  return [
    { label: copy.rerun, url: `${BRAND_URL}/seo-check` },
    { label: copy.submit, url: submit },
    { label: copy.pricing, url: `${BRAND_URL}/pricing` },
    { label: copy.tools, url: `${BRAND_URL}/tools` },
    { label: copy.dr, url: `${BRAND_URL}/tools/dr-checker` },
  ]
}

export function buildSeoReport(input: SeoReportInput, lang: SeoReportLang, when = new Date()): SeoReport {
  const copy = COPY[lang]
  const score = Math.max(0, Math.min(100, Math.round(Number(input.score) || 0)))
  const failsFirst = input.checks.filter((item) => item.status === 'fail')
  const warns = input.checks.filter((item) => item.status === 'warn')
  const statusLabel = (status: SeoCheckStatus) =>
    status === 'pass' ? copy.pass : status === 'warn' ? copy.warn : copy.fail
  const groupLabel = (key: string) => {
    const group = input.groups.find((item) => item.key === key)
    if (!group) return key
    return lang === 'zh' ? group.label_zh : group.label_en
  }
  return {
    lang,
    filename: seoPdfFilename(input.final_url, when),
    footer: BRAND_FOOTER,
    cover: {
      kicker: copy.kicker,
      title: copy.title,
      scoreLine: copy.score(score, input.grade || 'E'),
      checked: copy.checked(input.final_url),
      generated: copy.generated(shanghaiStamp(when)),
      rubric: copy.rubric(input.rubric ?? 1),
      brand: copy.brand,
      pitch: copy.pitch,
    },
    summaryTitle: copy.summary,
    verdict: score >= 85 ? copy.solid : score >= 60 ? copy.mid : copy.weak,
    tally: copy.tally(input.summary.pass, input.summary.warn, input.summary.fail),
    fixesTitle: copy.fixes,
    fixes: failsFirst.concat(warns).slice(0, 5).map((item) => ({
      tag: item.status === 'fail' ? copy.must : copy.worth,
      label: clip(item.label, 160),
      detail: clip(item.detail),
      how: item.fix ? `${copy.how}: ${clip(item.fix)}` : '',
    })),
    areasTitle: copy.areas,
    areas: input.groups.map((group) => ({
      label: lang === 'zh' ? group.label_zh : group.label_en,
      score: group.score,
      max: group.max,
    })),
    checksTitle: copy.all,
    checks: input.checks.map((item) => ({
      group: groupLabel(item.group),
      status: statusLabel(item.status),
      label: clip(item.label, 160),
      detail: clip(item.detail),
      how: item.fix ? clip(item.fix) : '',
    })),
    disclaimerTitle: copy.disclaimerTitle,
    disclaimer: [...copy.disclaimer],
    nextTitle: copy.next,
    next: seoReportLinks(input.final_url, lang),
  }
}
