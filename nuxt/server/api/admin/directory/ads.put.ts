/**
 * PUT /api/admin/directory/ads — edit a sponsor placement.
 *
 * Two bodies, both from the source page:
 *
 *   `{id, forceExpire: true}`   take an active placement down now
 *   `{id, name, tagline, url, iconUrl}`   the edit drawer's four creative fields
 *
 * The source's handler destructures `{ id, forceExpire, ...rest }` and routes on
 * `forceExpire` first, so a body carrying both still takes the take-down path.
 * Same order here.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import { forceExpireAdminAd, updateAdminAd } from '../../../utils/admin-directory'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const body = (await readBody(event)) as Record<string, unknown>
  const id = String(body?.id ?? '').trim()
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: 'ID is required', message_zh: '缺少 ID' },
    })
  }

  const db = await useDb(event)
  const str = (key: string) => String(body?.[key] ?? '').trim()

  try {
    if (body?.forceExpire === true) {
      return { ok: true, ...(await forceExpireAdminAd(db, id)) }
    }

    return {
      ok: true,
      ...(await updateAdminAd(db, id, {
        name: str('name'),
        tagline: str('tagline'),
        url: str('url'),
        iconUrl: str('iconUrl'),
      })),
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { message_en: (error as Error).message, message_zh: '保存失败，请检查填写内容' },
    })
  }
})
