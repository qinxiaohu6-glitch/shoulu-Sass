/**
 * /products/:slug.md — the same facts as the product page, in markdown.
 * Hidden and missing listings answer the same status the HTML page does.
 */
import { productMarkdown } from '~~/shared/utils/product-markdown'
import { publicProductName } from '~~/shared/utils/public-name'
import { localizeCategory, localizeTool, categories as catalogCategories } from '~~/shared/utils/catalog'
import { useDb } from '../../utils/db'
import { getDirectoryTool, listDirectoryCategories, listDirectoryTools } from '../../utils/directory'
import { isHidden, loadOverrides } from '../../utils/overrides'
import { getPublicBySlug, listPublishedTools, publicTool } from '../../utils/submissions'

export default defineEventHandler(async (event) => {
  const raw = String(getRouterParam(event, 'slug') ?? '').trim()
  const slug = raw.replace(/\.md$/i, '')
  if (!slug) {
    setResponseStatus(event, 404)
    return 'Not found'
  }

  const db = await useDb(event)
  if (await isHidden(db, slug)) {
    setResponseStatus(event, 410)
    return 'This listing has been removed'
  }

  const hit = await getDirectoryTool(db, slug)
  let tool = hit?.tool
  if (!tool) {
    const row = await getPublicBySlug(db, slug)
    if (!row) {
      setResponseStatus(event, 404)
      return 'No such product'
    }
    tool = publicTool(row)
  }

  const localized = localizeTool(tool, 'en')
  const [directory, published, categoryRows, overrides] = await Promise.all([
    listDirectoryTools(db),
    listPublishedTools(db).catch(() => []),
    listDirectoryCategories(db).catch(() => catalogCategories),
    loadOverrides(db),
  ])
  const hidden = new Set(overrides.hidden)
  const seen = new Set<string>()
  const live = []
  for (const entry of [...directory, ...published]) {
    if (seen.has(entry.slug) || hidden.has(entry.slug)) continue
    seen.add(entry.slug)
    live.push(entry)
  }
  const category = categoryRows.find((row) => row.slug === tool!.category)
  const categoryName = category ? localizeCategory(category, 'en').name : tool.category
  const related = live
    .filter((entry) => entry.slug !== tool!.slug && entry.category === tool!.category)
    .slice(0, 6)
    .map((entry) => {
      const view = localizeTool(entry, 'en')
      return { name: view.name, slug: view.slug, short: view.short }
    })

  setHeader(event, 'content-type', 'text/markdown; charset=utf-8')
  setHeader(event, 'cache-control', 'no-store')
  return productMarkdown({
    name: publicProductName(localized.name),
    short: localized.short,
    long: localized.long,
    url: localized.url,
    category: categoryName,
    maker: localized.makerName,
    features: localized.detail.features,
    pricingLabel: localized.detail.pricing?.label ?? '',
    pricingUrl: localized.detail.pricing?.url ?? '',
    related,
  })
})
