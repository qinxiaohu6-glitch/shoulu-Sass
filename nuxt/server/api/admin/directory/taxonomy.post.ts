/**
 * POST /api/admin/directory/taxonomy — categories and tags in one route.
 *
 * They are the same operation with different columns: a slug, an order, a name
 * per language, and for a category an icon and a blurb. Two routes would have
 * been two copies of the same validation, and the console's two pages are
 * already one component with a `kind` prop.
 *
 * `kind` decides which table is written; it is never trusted to name a table
 * directly, so a bad request cannot reach SQL.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { deleteTag, hideCategory, saveCategory, saveTag } from '../../../utils/directory'

const SLUG = /^[a-z0-9][a-z0-9-]*$/

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asInt(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

function badRequest(message_en: string, message_zh: string) {
  return createError({ statusCode: 400, statusMessage: 'Bad Request', data: { message_en, message_zh } })
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event)) as {
    kind?: string
    action?: string
    item?: Record<string, unknown>
  }

  const kind = asString(body?.kind)
  const action = asString(body?.action) || 'save'
  const raw = (body?.item ?? {}) as Record<string, unknown>
  const slug = asString(raw.slug).toLowerCase()

  if (kind !== 'category' && kind !== 'tag') {
    throw badRequest('Unknown taxonomy kind.', '未知的分类类型。')
  }
  if (!SLUG.test(slug) || slug.length > 60) {
    throw badRequest(
      'The slug may only contain lowercase letters, digits and hyphens.',
      'Slug 只能用小写字母、数字和连字符。',
    )
  }

  const db = await useDb(event)

  if (kind === 'tag') {
    if (action === 'delete') {
      const removed = await deleteTag(db, slug)
      if (!removed) {
        throw badRequest(
          'This tag ships with the catalogue, so it cannot be deleted — rename it instead.',
          '这条标签来自内置目录，删不掉；改个名字就行。',
        )
      }
      return { ok: true, slug, deleted: true }
    }
    await saveTag(db, {
      slug,
      sort: asInt(raw.sort),
      en: { name: asString(raw.name_en) },
      zh: { name: asString(raw.name_zh) },
    })
    return { ok: true, slug }
  }

  if (action === 'delete') {
    await hideCategory(db, slug)
    return { ok: true, slug, deleted: true }
  }

  await saveCategory(db, {
    slug,
    icon: asString(raw.icon),
    sort: asInt(raw.sort),
    // A save is also the restore path: sending `status: 'published'` for a
    // tombstoned slug is what brings it back, so there is no third action.
    status: asString(raw.status) || 'published',
    en: { name: asString(raw.name_en), description: asString(raw.desc_en) },
    zh: { name: asString(raw.name_zh), description: asString(raw.desc_zh) },
  })
  return { ok: true, slug }
})
