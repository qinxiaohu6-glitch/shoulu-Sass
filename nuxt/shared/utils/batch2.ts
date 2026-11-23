/**
 * Batch 2 public facts. Approved English sentences are copied verbatim.
 * Chinese sentences that were not in the 11-14 review are plain translations
 * of those facts and are listed in the review PR.
 */
export const ASK_PROMPT =
  'Read https://dirtool.com/llms.txt and the dirtool page I care about. Summarize only what that page states. Do not invent traffic, rankings, or prices. If a number can change, say when you read it.'

export const LLMS_URL = 'https://dirtool.com/llms.txt'

export const FEATURES_EMPTY = 'This listing does not include a features section.'
export const PRICING_EMPTY = 'This listing does not include a pricing section.'
export const RELATED_HEADING = 'Related in this category'
export const CHECKED_BLOCK =
  'This page checked the public name, short description, category, maker, and links the submitter provided. It did not check revenue, rank, traffic, or DR. It is not an editorial endorsement.'

export const L2 =
  'Paid listings go live when payment succeeds. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy.'
export const L2_ZH =
  '付费档在付款成功后自动发布。免费收录由人工审核。中位审核时间见统计页；忙碌时请按最多 7–14 天来预期。'

export const L3 =
  'A directory of software products. Each listing has a page with what the product does, its category, and its maker. Paid listings carry a permanent dofollow link; free listings are nofollow and are reviewed by a person.'
export const L4 =
  'Boost goes live when payment succeeds. Standard, Featured, and Pro are no longer sold; a listing already paid for stays until its pin date ends. We review free listings by hand. The median time is shown on the stats page; plan for up to 7–14 days when it is busy.'
export const L5 =
  'Four ways to show up. Listed prices where we have them; a written review is quoted by an editor.'
export const WRITTEN_REVIEW_HONEST =
  'This page has no self-serve price, so it does not open a checkout.'

export const FOOTER_BACKLINK = 'List your product. Paid listings keep a dofollow backlink.'
export const LIVE_NUMBERS =
  'Every number on this page comes from the live directory. No estimated visits or authority.'
export const BADGE_OPTIONAL =
  'A listing badge is optional. Paid listings already include a dofollow link; you do not need to display the badge to keep it.'
export const LOGIN_GO_LIVE =
  'When payment succeeds, a Boost listing or a weekly ad goes live automatically.'
export const REFUND_FAQ =
  'If we do not deliver the placement, or we charge you in error, we refund it. After the listing or placement is live, we do not refund a change of mind or weak results. Full terms are in the billing section.'
export const BILLBOARD_PAY_AGAIN =
  'New Billboard bids are closed. Placements already paid for stay on the board.'
export const CATEGORIES_INTRO_EIGHT = 'Every listing sits in one of these eight categories.'
export const TAGS_INTRO = 'Browse listings by tag. Tags with no listings are hidden.'
export const PRODUCTS_H1 = 'All products'
export const GUEST_POST_TITLE = 'Written review · dirtool'

export const HOW_FREE_LINK = 'Free listings are nofollow. Paid listings carry a permanent dofollow link.'
export const HOW_WEEKLY = 'A paid listing does not change the weekly board. The board is ranked by votes.'
export const HOW_BADGE_NOT_REQUIRED = 'A badge is not required.'

export const VIDEO_CATEGORY = 'video'
export const VIDEO_REQUIRED_TAGS = [
  { slug: 'video-generation', name: 'Video generation' },
  { slug: 'video-chat', name: 'Video chat' },
  { slug: 'transcripts', name: 'Transcripts' },
] as const

export function tagSlug(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function videoTagSatisfied(tags: string[]): boolean {
  const slugs = new Set(tags.map(tagSlug))
  const names = new Set(tags.map((tag) => tag.trim().toLowerCase()))
  return VIDEO_REQUIRED_TAGS.some(
    (tag) => slugs.has(tag.slug) || names.has(tag.name.toLowerCase()) || names.has(tag.slug),
  )
}

export function submissionTagError(category: string, tags: string[]): 'tags_required' | 'video_tag_required' | null {
  const kept = tags.map((tag) => tag.trim()).filter(Boolean)
  if (kept.length < 1) return 'tags_required'
  if (category === VIDEO_CATEGORY && !videoTagSatisfied(kept)) return 'video_tag_required'
  return null
}

export function categoriesIntro(count: number): string {
  if (count === 8) return CATEGORIES_INTRO_EIGHT
  return `Every listing sits in one of these ${count} categories.`
}

export function freeQueueLine(count: number): string {
  const noun = count === 1 ? 'listing' : 'listings'
  return `${count} free ${noun} waiting for review`
}

export function askPromptFor(pageUrl: string): string {
  return `${ASK_PROMPT}\n\nPage: ${pageUrl}`
}

export function askAssistantHref(
  assistant: 'chatgpt' | 'claude' | 'perplexity' | 'grok',
  pageUrl: string,
): string {
  const q = encodeURIComponent(askPromptFor(pageUrl))
  if (assistant === 'chatgpt') return `https://chatgpt.com/?q=${q}`
  if (assistant === 'claude') return `https://claude.ai/new?q=${q}`
  if (assistant === 'perplexity') return `https://www.perplexity.ai/search?q=${q}`
  return `https://grok.com/?q=${q}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function isoWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return String(week).padStart(2, '0')
}

/** `Nov 9–Nov 15, 2026 (W46)`, using the week that contains `now`. */
export function currentPeriodLabel(now = new Date()): string {
  const monday = new Date(now)
  const day = monday.getDay() || 7
  monday.setDate(monday.getDate() - (day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const week = isoWeekNumber(monday)
  const start = `${MONTHS[monday.getMonth()]} ${monday.getDate()}`
  const end = `${MONTHS[sunday.getMonth()]} ${sunday.getDate()}`
  return `${start}–${end}, ${sunday.getFullYear()} (W${week})`
}

/**
 * Category blurbs the 11-14 table approved. Developer Tools and Writing are
 * absent on purpose: their current descriptions stay.
 */
export const CATEGORY_AFTER: Record<string, { en: string; zh: string }> = {
  chatbots: {
    en: 'Assistants and other products currently listed in this category.',
    zh: '当前列在这一分类里的助手和其他产品。',
  },
  image: {
    en: 'Images, design utilities, and visual production tools.',
    zh: '图像、设计工具和视觉生产工具。',
  },
  video: {
    en: 'Video generation, editing, transcripts, and live video chat.',
    zh: '视频生成、剪辑、转录和实时视频聊天。',
  },
  audio: {
    en: 'Audio tools, music utilities, and generated or edited sound.',
    zh: '音频工具、音乐工具，以及生成或编辑过的声音。',
  },
  productivity: {
    en: 'Everyday work tools, from documents and timers to utilities.',
    zh: '日常工作工具，从文档和计时器到实用小工具。',
  },
  research: {
    en: 'Data, lookup tools, and research products.',
    zh: '数据、查询工具和研究产品。',
  },
}

/** Previous public blurbs. A stored row that still has one of these is replaced. */
export const CATEGORY_BEFORE: Record<string, { en: string; zh: string }> = {
  chatbots: {
    en: 'General-purpose assistants you can talk to.',
    zh: '通用对话助手，什么问题都能接。',
  },
  image: {
    en: 'Image generation, UI and creative production.',
    zh: '图像生成、界面与创意生产工具。',
  },
  video: {
    en: 'Generate, edit and translate video.',
    zh: '视频生成、剪辑与翻译。',
  },
  audio: {
    en: 'Text-to-speech, voice cloning and AI music.',
    zh: '语音合成、声音克隆与音乐生成。',
  },
  productivity: {
    en: 'Slides, notes and meetings, done faster.',
    zh: '幻灯片、笔记与会议，做得更快。',
  },
  research: {
    en: 'Answer engines and research assistants.',
    zh: '答案引擎与研究助手。',
  },
}

export function publicCategoryDescription(slug: string, locale: 'en' | 'zh', stored: string): string {
  const after = CATEGORY_AFTER[slug]
  if (!after) return stored
  const trimmed = stored.trim()
  if (!trimmed) return after[locale]
  const before = CATEGORY_BEFORE[slug]
  if (before && (trimmed === before.en || trimmed === before.zh)) return after[locale]
  return stored
}
