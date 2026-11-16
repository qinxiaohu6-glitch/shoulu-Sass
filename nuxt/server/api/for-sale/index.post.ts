/**
 * POST /api/for-sale — save a seller's draft or update an up listing.
 *
 * The body may carry the asking price. It must not be treated as the fee.
 * Login and ownership are required. Nothing here publishes the row.
 */

import { cleanFields, missingForSaleTable, requireSeller, saveForSaleListing, ownerView } from '../../utils/for-sale'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const session = await requireSeller(event)
  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  const slug = String(body?.product_slug || '').trim()
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Bad Request' })

  const cleaned = cleanFields({
    asking: body?.asking_price,
    revenue: body?.revenue,
    profit: body?.profit,
    team: body?.team,
    stack: body?.stack,
  })
  if (!cleaned.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: {
        reason: cleaned.reason,
        message_en: 'Check the asking price and shorten any field that is too long or full of links.',
        message_zh: '请检查要价，并缩短过长或链接过多的字段。',
      },
    })
  }

  try {
    const db = await useDb(event)
    const row = await saveForSaleListing(db, session, slug, cleaned.fields)
    return { ok: true, listing: ownerView(row, 0) }
  } catch (err) {
    if (missingForSaleTable(err)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        data: {
          reason: 'unconfigured',
          message_en: 'Could not open the payment page — try again in a moment.',
          message_zh: '暂时打不开付款页面，请稍后再试。',
        },
      })
    }
    const code = (err as { code?: string }).code
    if (code === 'not_owner') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        data: {
          reason: 'not_owner',
          message_en: 'You can list a product for sale only when you own its live directory page.',
          message_zh: '只有你名下已上线的目录页可以上架待售。',
        },
      })
    }
    if (code === 'relist_first') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        data: {
          reason: 'relist_first',
          message_en: 'This listing was unlisted. List it again to pay another $9.90.',
          message_zh: '这条待售已下架。再次上架需要再付 $9.90。',
        },
      })
    }
    throw err
  }
})
