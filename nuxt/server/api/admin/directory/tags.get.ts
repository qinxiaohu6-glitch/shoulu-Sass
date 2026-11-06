/**
 * GET /api/admin/directory/tags — the console's tag list.
 *
 * Paged, searchable and counted, which is what `admin.directory.tags` renders.
 * The public `/api/directory` payload already carries every tag, but it carries
 * the *resolved* view (catalogue merged in, no per-locale description) and the
 * console edits rows, so it reads them through `listAdminTags`.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { listAdminTagOptions, listAdminTags } from '../../../utils/admin-directory'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)
  const db = await useDb(event)

  // `?all=true` is the tool form's tag picker: every tag, no paging.
  if (query.all === 'true') {
    return { ok: true, items: await listAdminTagOptions(db) }
  }

  const { items, total } = await listAdminTags(db, {
    page: Number(query.page) || 1,
    pageSize: Number(query.pageSize) || 20,
    search: typeof query.search === 'string' ? query.search : undefined,
  })

  return { ok: true, items, total }
})
