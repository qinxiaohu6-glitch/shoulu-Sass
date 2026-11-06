/**
 * Small HTTP helpers shared by the write endpoints: error-code → status +
 * bilingual copy, client IP, and the salted IP hash.
 *
 * The error table is ported from the old server so the submit form shows the
 * same wording it did before the rebuild — a rejection that changes its mind
 * about *why* it rejected is worse than a terse one.
 */

import type { H3Event } from 'h3'

type ErrorCopy = { status: number; zh: string; en: string }

export const SUBMIT_ERRORS: Record<string, ErrorCopy> = {
  invalid_url: {
    status: 400,
    zh: '这个网址看起来不对，试试 https://your-site.com',
    en: 'That does not look like a URL. Try https://your-site.com',
  },
  required: { status: 400, zh: '必填项还没填。', en: 'A required field is empty.' },
  too_short: { status: 400, zh: '写得再具体一点。', en: 'That is a little too short.' },
  no_links: {
    status: 400,
    zh: '简介里不能放链接，链接请填在「网址」一栏。',
    en: 'No links in the description — use the URL field.',
  },
  bad_category: { status: 400, zh: '请选择一个分类。', en: 'Pick a category.' },
  bad_email: { status: 400, zh: '邮箱格式不对。', en: 'That email address is not valid.' },
  already_listed: { status: 409, zh: '这个站点已经在目录里了。', en: 'That site is already listed.' },
  duplicate: {
    status: 409,
    zh: '这个站点已经提交过了，正在处理中。',
    en: 'That site has already been submitted and is in the queue.',
  },
  rate_limited: {
    status: 429,
    zh: '提交太频繁了，过一会儿再试。',
    en: 'Too many submissions — try again later.',
  },
  closed: { status: 503, zh: '提交暂时关闭。', en: 'Submissions are temporarily closed.' },
  bad_payload: { status: 400, zh: '请求格式不对。', en: 'Bad request.' },
  not_found: { status: 404, zh: '找不到这条提交。', en: 'No such submission.' },
  not_your_listing: {
    status: 403,
    zh: '这条提交不属于当前账号。',
    en: 'That listing belongs to a different account.',
  },
  signin_required: { status: 401, zh: '登录后才能操作。', en: 'Sign in to continue.' },
  bad_action: { status: 400, zh: '未知的操作。', en: 'Unknown action.' },
  payment_required: {
    status: 409,
    zh: '付费档须先确认收款，才能公开详情。',
    en: 'Confirm payment before a paid listing can go live.',
  },
  storage_unavailable: {
    status: 503,
    zh: '提交存储暂时不可用，请稍后再试。',
    en: 'Submission storage is unavailable right now.',
  },
  // Ticket codes live in this table rather than a second one: the console and
  // the settings page both render `message_zh` / `message_en` verbatim, and two
  // error vocabularies would mean two places to look when a message reads wrong.
  too_long: {
    status: 400,
    zh: '内容太长了，缩短一些再发。',
    en: 'That is too long — trim it and try again.',
  },
  bad_attachments: {
    status: 400,
    zh: '图片链接不对：最多 9 个，必须是 / 开头的站内路径或 http(s) 链接。',
    en: 'Bad image links: at most 9, each a site path starting with / or an http(s) URL.',
  },
  ticket_closed: {
    status: 409,
    zh: '这个工单已经关闭了，需要继续沟通请新建一个。',
    en: 'This ticket is closed. Open a new one if you need more help.',
  },
  // Same conditions as `not_found` / `rate_limited`, different nouns. The
  // submit wording says "submission" and is quoted from the old build, so it
  // cannot be generalised without changing a page that already shipped.
  ticket_not_found: {
    status: 404,
    zh: '找不到这个工单。',
    en: 'No such ticket.',
  },
  ticket_rate_limited: {
    status: 429,
    zh: '刚提交过一张工单，30 秒后再建新的。',
    en: 'You just opened a ticket — wait 30 seconds before opening another.',
  },
  internal_error: {
    status: 500,
    zh: '我们这边出了点问题，请稍后再试。',
    en: 'Something went wrong on our side.',
  },
}

/**
 * Turn a coded error into a response the form can render.
 *
 * The bilingual pair is sent on every error rather than resolved client-side,
 * because the message is part of the contract: the old form already displays
 * `message_zh` / `message_en` verbatim.
 *
 * The code is read structurally rather than with `instanceof`, so ticket
 * errors can use the same table without importing a class named after
 * submissions. Anything whose code is not in the table is reported as
 * `internal_error` — a Node `ENOENT` must not surface as a reason.
 */
export function sendSubmitError(event: H3Event, err: unknown) {
  const raw = (err as { code?: unknown } | null)?.code
  const code = typeof raw === 'string' && raw in SUBMIT_ERRORS ? raw : 'internal_error'
  const copy = SUBMIT_ERRORS[code]!
  setResponseStatus(event, copy.status)
  return {
    ok: false,
    reason: code,
    field: (err as { field?: string } | null)?.field ?? null,
    message_zh: copy.zh,
    message_en: copy.en,
  }
}

/**
 * Best-effort client IP.
 *
 * Cloudflare always sets `CF-Connecting-IP`; behind a plain proxy the first
 * `X-Forwarded-For` hop is the client. Neither is trustworthy on its own, but
 * this value is only ever used for a salted quota hash — never for auth.
 */
export function clientIp(event: H3Event): string {
  const h = getRequestHeader(event, 'cf-connecting-ip')
  if (h) return h.trim()
  const fwd = getRequestHeader(event, 'x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return getRequestHeader(event, 'x-real-ip')?.trim() || '0.0.0.0'
}

/**
 * Salted hash of the IP, never the address itself.
 *
 * Submissions keep this for quota and abuse review. Storing the raw IP would
 * turn a product directory into a log of who visited whom.
 */
export async function hashIp(ip: string, event?: H3Event): Promise<string> {
  // The event is what makes `NUXT_IP_SALT` readable on Workers; without it this
  // silently falls back to the published `dev-salt`. See `utils/admin.ts`.
  const salt = useRuntimeConfig(event).ipSalt || 'dev-salt'
  const data = new TextEncoder().encode(salt + ip)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}
