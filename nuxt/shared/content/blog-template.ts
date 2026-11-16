/**
 * Blog templates and the first-article outline (batch 3, C1).
 *
 * This file is the template and the direction. It is not the article.
 * There is no long body here, and the deleted demo posts stay deleted.
 * A comparison article is not part of this batch.
 */

export type BlogTemplateKind = 'guide' | 'comparison' | 'directory-note'

export type BlogTemplate = {
  kind: BlogTemplateKind
  label_en: string
  label_zh: string
  /** What a finished post of this kind is allowed to do. */
  purpose_en: string
  purpose_zh: string
  /** Slots a later draft has to fill. Not the draft. */
  slots_en: readonly string[]
  slots_zh: readonly string[]
}

export const BLOG_TEMPLATES: readonly BlogTemplate[] = [
  {
    kind: 'guide',
    label_en: 'Guide',
    label_zh: '指南',
    purpose_en: 'Explain a mechanism that is already a published rule on Product Atlas.',
    purpose_zh: '解释 Product Atlas 已经公开的规则，不另写一套。',
    slots_en: [
      'What the page is',
      'How a listing starts',
      'Free or pay once',
      'When it goes live',
      'What the link is',
      'What is refused',
    ],
    slots_zh: [
      '页面是什么',
      '收录从哪里开始',
      '免费或一次付费',
      '何时上线',
      '链接是什么',
      '什么会被拒绝',
    ],
  },
  {
    kind: 'comparison',
    label_en: 'Comparison',
    label_zh: '对比',
    purpose_en: 'Compare options using only facts this site already publishes. No comparison article is part of this batch.',
    purpose_zh: '只用本站已经公开的事实做对比。这一批不写对比文。',
    slots_en: ['What each side is', 'What this site does', 'What this site does not do'],
    slots_zh: ['两边各是什么', '本站做什么', '本站不做什么'],
  },
  {
    kind: 'directory-note',
    label_en: 'Directory note',
    label_zh: '目录动态',
    purpose_en: 'A short note whose numbers are read from /stats on the day it is written. Do not invent a count.',
    purpose_zh: '短注里的数字取写作当天的 /stats。不要编造数量。',
    slots_en: ['What changed', 'The live number and the date', 'Where to read it'],
    slots_zh: ['变了什么', '当天的数字和日期', '到哪里看'],
  },
]

export type OutlineSection = {
  heading_en: string
  heading_zh: string
  /** One direction sentence for the later draft. Not a section of the article. */
  direction_en: string
  direction_zh: string
}

export type ArticleOutline = {
  slug: string
  template: BlogTemplateKind
  /** An outline is not a published post. */
  status: 'outline'
  title: string
  direction_en: string
  direction_zh: string
  sections: readonly OutlineSection[]
}

/**
 * First article. Topic locked by the 2026-11-14 decision memo, item 7.
 * Directions quote listing rules that are already approved, including L2.
 */
export const FIRST_ARTICLE: ArticleOutline = {
  slug: 'how-to-list-a-product',
  template: 'guide',
  status: 'outline',
  title: 'How to list a product on Product Atlas',
  direction_en:
    'A mechanism article. Use only listing rules that are already approved. Do not write the long body until a separate review.',
  direction_zh: '机制文。只用已经拍板的收录规则。长正文等另一次审稿，这一页只是大纲。',
  sections: [
    {
      heading_en: 'What a listing page is',
      heading_zh: '收录页是什么',
      direction_en:
        'Each listing has a page with what the product does, its category, and its maker.',
      direction_zh: '每个收录页写明产品做什么、属于哪个分类，以及创客是谁。',
    },
    {
      heading_en: 'Start from the product URL',
      heading_zh: '从产品网址开始',
      direction_en: 'Paste your URL first. We draft the listing. Sign in only when you save it or pay.',
      direction_zh: '先粘贴网址。我们起草收录。只在保存或付款时登录。',
    },
    {
      heading_en: 'Free, or pay once',
      heading_zh: '免费，或一次付费',
      direction_en: 'Free to list, or pay once to go live when payment succeeds.',
      direction_zh: '可以免费提交，或一次付费，付款成功后上线。',
    },
    {
      heading_en: 'When a listing goes live',
      heading_zh: '何时上线',
      direction_en:
        'Paid listings go live when payment succeeds. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy.',
      direction_zh:
        '付费档在付款成功后自动发布。免费收录由人工审核。中位审核时间见统计页；忙碌时请按最多 7–14 天来预期。',
    },
    {
      heading_en: 'What the link is',
      heading_zh: '链接是什么',
      direction_en:
        'Paid listings carry a permanent dofollow link; free listings are nofollow and are reviewed by a person.',
      direction_zh: '付费收录带永久 dofollow 链接；免费收录是 nofollow，并由人工审核。',
    },
    {
      heading_en: 'When a maker profile exists',
      heading_zh: '创客档案何时出现',
      direction_en:
        'Every maker with a live product gets a public profile. This page has no public feed.',
      direction_zh: '每有一款在架产品，对应创客就有公开档案。社区页没有公开 Feed。',
    },
    {
      heading_en: 'What is refused',
      heading_zh: '什么会被拒绝',
      direction_en:
        'Spam and adult content are not listed. That is the same rule as the rest of the directory, on /rules. Do not write this as a social posting policy.',
      direction_zh:
        '垃圾内容和成人内容不会被收录。这与目录现行规则相同，见 /rules。不要写成社交发帖规则。',
    },
    {
      heading_en: 'Where the review time is counted',
      heading_zh: '审核时间记在哪里',
      direction_en:
        'The median time is on /stats. For free listings that have already been reviewed. Do not invent a headcount.',
      direction_zh: '中位时间在 /stats。仅针对已审完的免费收录。不要编造人数。',
    },
  ],
}

export function articleOutline(slug: string): ArticleOutline | null {
  return slug === FIRST_ARTICLE.slug ? FIRST_ARTICLE : null
}

export function blogTemplate(kind: BlogTemplateKind): BlogTemplate | undefined {
  return BLOG_TEMPLATES.find((template) => template.kind === kind)
}

/** Directions only, so a test can reject a long unsanctioned body. */
export function outlineDirectionLength(outline: ArticleOutline = FIRST_ARTICLE): number {
  return [outline.direction_en, ...outline.sections.map((section) => section.direction_en)].join('\n').length
}
