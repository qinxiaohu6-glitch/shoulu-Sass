/**
 * DELETE /api/admin/directory/tags?id=… — remove one tag.
 *
 * `deleteTag` refuses the tags that ship with the built-in catalogue: their
 * rows are re-derived from `catalog.json` on the next read, so deleting would
 * look like it worked and then quietly undo itself. Tags created in the console
 * delete normally. The refusal is reported as a 400 with a reason rather than a
 * silent success, and the page toasts it — the source's own error path.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { deleteTag } from '../../../utils/directory'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const id = String(getQuery(event).id ?? '').trim()
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: 'ID is required', message_zh: '缺少 ID' },
    })
  }

  const db = await useDb(event)
  const removed = await deleteTag(db, id)
  if (!removed) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        message_en: 'This tag ships with the catalogue, so it cannot be deleted — rename it instead.',
        message_zh: '这条标签来自内置目录，删不掉；改个名字就行。',
      },
    })
  }

  return { ok: true }
})
