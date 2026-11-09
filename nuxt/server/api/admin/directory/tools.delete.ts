/**
 * DELETE /api/admin/directory/tools?id=… — remove one listing.
 *
 * Only an unpublished listing can go. `tool_overrides.hidden` counts: P0 hide
 * does not change `dir_tool.status`, and a hidden catalogue preset or a hidden
 * community submission is already off the public site. A listing that is still
 * published has to be unpublished first. There is no bulk delete.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { deleteAdminTool } from '../../../utils/admin-directory'
import { DELETE_STILL_PUBLISHED } from '~~/shared/utils/listing-desk'

function deleteCopy(message: string): { en: string; zh: string } {
  if (message === DELETE_STILL_PUBLISHED) {
    return {
      en: message,
      zh: '仅未发布的工具可删除，请先强制下架',
    }
  }
  if (message === 'Tool not found') {
    return { en: message, zh: '找不到这个工具' }
  }
  return { en: message, zh: '删除失败，请稍后再试' }
}

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
  try {
    return { ok: true, ...(await deleteAdminTool(db, id)) }
  } catch (error) {
    const copy = deleteCopy((error as Error).message)
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: copy.en, message_zh: copy.zh },
    })
  }
})
