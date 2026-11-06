/**
 * POST /api/admin/directory/tool — create, update or delete one listing.
 *
 * The body carries a whole `Tool`, not a patch. The form already holds every
 * field, and a whole-object write is the only shape that can express "clear
 * this field": a patch cannot tell `''` from "not mentioned". The cost is that
 * the client must send everything, which the console does because it edits a
 * copy of the row it loaded.
 *
 * Slugs are immutable. Renaming one would silently break every inbound link
 * and every ranking it has, so a slug that already exists is updated in place
 * and the console shows the field read-only once a row has been created.
 */

import type { DetailBlock, Tool } from '~~/shared/types/catalog'
import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import {
  deleteDirectoryTool,
  saveToolHead,
  saveToolTranslation,
} from '../../../utils/directory'

const SLUG = /^[a-z0-9][a-z0-9-]*$/

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asText(value: unknown): string {
  // Long copy keeps its internal newlines but not its trailing whitespace.
  return typeof value === 'string' ? value.replace(/\s+$/, '') : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => asString(item)).filter(Boolean)
}

function asInt(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

function asDate(value: unknown): string {
  const raw = asString(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}

/**
 * A malformed section drops out instead of failing the save.
 *
 * The editor writes whole blocks, so a bad shape means a hand-edited request
 * or a client bug; refusing the entire listing over one stray FAQ would lose
 * the operator's other twenty fields.
 */
function asDetail(value: unknown): DetailBlock {
  const block = (value ?? {}) as Partial<DetailBlock>
  const items = (raw: unknown) =>
    Array.isArray(raw)
      ? raw
          .map((item) => ({
            title: asString((item as { title?: unknown })?.title),
            desc: asText((item as { desc?: unknown })?.desc),
          }))
          .filter((item) => item.title || item.desc)
      : []
  const faqs = Array.isArray(block.faqs)
    ? block.faqs
        .map((item) => ({ q: asString(item?.q), a: asText(item?.a) }))
        .filter((item) => item.q || item.a)
    : []
  return {
    how_to_use: asStringArray(block.how_to_use),
    features: items(block.features),
    use_cases: items(block.use_cases),
    pros: asStringArray(block.pros),
    cons: asStringArray(block.cons),
    faqs,
  }
}

function normalize(raw: Record<string, unknown>): Tool {
  return {
    slug: asString(raw.slug).toLowerCase(),
    name_en: asString(raw.name_en),
    name_zh: asString(raw.name_zh),
    short_en: asString(raw.short_en),
    short_zh: asString(raw.short_zh),
    long_en: asText(raw.long_en),
    long_zh: asText(raw.long_zh),
    url: asString(raw.url),
    logo: asString(raw.logo),
    category: asString(raw.category),
    tags: asStringArray(raw.tags),
    status: asString(raw.status) || 'approved',
    is_featured: Boolean(raw.is_featured),
    is_paid: Boolean(raw.is_paid),
    featured_until: asDate(raw.featured_until),
    votes_total: Math.max(0, asInt(raw.votes_total)),
    votes_week: Math.max(0, asInt(raw.votes_week)),
    created_at: asDate(raw.created_at),
    maker: asString(raw.maker),
    shots: asStringArray(raw.shots),
    detail_en: asDetail(raw.detail_en),
    detail_zh: asDetail(raw.detail_zh),
  }
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event)) as { action?: string; tool?: Record<string, unknown> }
  const action = asString(body?.action) || 'save'
  const db = await useDb(event)

  const slug = asString(body?.tool?.slug).toLowerCase()
  if (!SLUG.test(slug) || slug.length > 80) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        message_en: 'The slug may only contain lowercase letters, digits and hyphens.',
        message_zh: 'Slug 只能用小写字母、数字和连字符。',
      },
    })
  }

  if (action === 'delete') {
    await deleteDirectoryTool(db, slug)
    return { ok: true, slug, deleted: true }
  }

  const tool = normalize(body.tool as Record<string, unknown>)

  // A listing with no name in either language renders as an empty card in
  // every list it appears in. Refuse it here rather than discover it on the
  // home page.
  if (!tool.name_en && !tool.name_zh) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        message_en: 'A listing needs a name in at least one language.',
        message_zh: '至少要填一种语言的名称。',
      },
    })
  }

  await saveToolHead(db, tool)

  await saveToolTranslation(db, tool.slug, 'en', {
    name: tool.name_en,
    short: tool.short_en,
    long_desc: tool.long_en,
    detail: asDetail(tool.detail_en),
  })
  await saveToolTranslation(db, tool.slug, 'zh', {
    name: tool.name_zh,
    short: tool.short_zh,
    long_desc: tool.long_zh,
    detail: asDetail(tool.detail_zh),
  })

  return { ok: true, slug: tool.slug }
})
