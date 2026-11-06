/**
 * POST /api/admin/directory/collection — create, update or delete a collection.
 *
 * Membership is sent as the finished sequence, not as a diff. The editor's
 * up/down buttons only produce a new order, and reconstructing "moved one item
 * up" from two arrays is guesswork that fails the moment someone reorders by
 * hand. Replacing the whole list is one delete plus N inserts and is always
 * exactly what the screen showed.
 *
 * Unknown tool slugs are dropped rather than rejected: a collection whose
 * member was deleted from the directory should still save, minus that member.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { deleteCollection, listDirectoryTools, saveCollection } from '../../../utils/directory'

const SLUG = /^[a-z0-9][a-z0-9-]*$/

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asInt(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event)) as {
    action?: string
    item?: Record<string, unknown>
  }

  const action = asString(body?.action) || 'save'
  const raw = (body?.item ?? {}) as Record<string, unknown>
  const slug = asString(raw.slug).toLowerCase()

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

  const db = await useDb(event)

  if (action === 'delete') {
    await deleteCollection(db, slug)
    return { ok: true, slug, deleted: true }
  }

  const requested = Array.isArray(raw.tools)
    ? raw.tools.map((item) => asString(item).toLowerCase()).filter(Boolean)
    : []

  // Keep the order the editor chose, but only for slugs that exist. Dedupe
  // because the primary key would reject a repeat and fail the whole save.
  //
  // "Exists" means a listing, not a row in `dir_tool`: the tables are an
  // overlay, so a freshly deployed database with no seeded rows still has all
  // thirty catalogue tools. Validating against `dir_tool` alone would silently
  // drop every member on such a database — the save would report success and
  // the collection would come back empty.
  const known = new Set((await listDirectoryTools(db)).map((tool) => tool.slug))
  const tools = [...new Set(requested)].filter((toolSlug) => known.has(toolSlug))

  await saveCollection(db, {
    slug,
    icon: asString(raw.icon),
    cover: asString(raw.cover),
    sort: asInt(raw.sort),
    status: asString(raw.status) || 'published',
    en: { name: asString(raw.name_en), description: asString(raw.desc_en) },
    zh: { name: asString(raw.name_zh), description: asString(raw.desc_zh) },
    tools,
  })

  return { ok: true, slug, dropped: requested.length - tools.length }
})
