import type { H3Event } from 'h3'
import type { Collection } from '~~/shared/types/catalog'
import { allMakers, categories, localizeTool, tags, tools, weeks } from '~~/shared/utils/catalog'
import type { OverrideView } from '~~/shared/utils/catalog'
import { useDb } from '../utils/db'
import { listDirectoryCollections } from '../utils/directory'
import { loadOverrides } from '../utils/overrides'
import { listPublishedTools } from '../utils/submissions'

const SITE = 'https://dirtool.com'

type Entry = { path: string; lastmod?: string; priority: string }

/**
 * Every public page, one entry per language. Kept in one place so the sitemap,
 * robots.txt and llms.txt cannot drift apart.
 *
 * Excluded on purpose: /submit and /sign-in (transactional, no search value),
 * /settings and /admin (behind a session), /api/*.
 */
async function entries(event: H3Event): Promise<Entry[]> {
  const today = new Date().toISOString().slice(0, 10)

  // One database read answers both questions below: which listings an operator
  // has pulled, and what the community has published. A failure leaves both
  // empty, so the static list still ships rather than the whole sitemap 500ing.
  let published: Awaited<ReturnType<typeof listPublishedTools>> = []
  let overrides: OverrideView = { pinned: {}, hidden: [] }
  // Collections live only in the database — there is no catalogue to fall back
  // to — so an unreadable database means no collection URLs rather than a
  // guess at what they might have been.
  let collections: Collection[] = []
  try {
    const db = await useDb(event)
    ;[published, overrides, collections] = await Promise.all([
      listPublishedTools(db),
      loadOverrides(db),
      listDirectoryCollections(db),
    ])
  } catch (err) {
    console.error('[sitemap] database unavailable, serving the static list only', err)
  }

  // A hidden page answers 410. Listing it would ask Google to fetch a URL the
  // site has deliberately retired, so it leaves the sitemap the same moment it
  // leaves the directory.
  const hidden = new Set(overrides.hidden)
  const visible = (slug: string) => !hidden.has(slug)

  const list: Entry[] = [
    { path: '/', priority: '1.0' },
    { path: '/tools', priority: '0.9' },
    { path: '/categories', priority: '0.8' },
    { path: '/collections', priority: '0.8' },
    { path: '/weekly', priority: '0.8' },
    { path: '/just-added', priority: '0.7' },
    { path: '/tags', priority: '0.6' },
    { path: '/makers', priority: '0.6' },
    { path: '/pricing', priority: '0.8' },
    { path: '/privacy-policy', priority: '0.2' },
    { path: '/terms-of-service', priority: '0.2' },
  ].map((e) => ({ ...e, lastmod: today }))

  for (const tool of tools) {
    if (!visible(tool.slug)) continue
    list.push({ path: `/tools/${tool.slug}`, lastmod: tool.created_at, priority: '0.9' })
  }
  for (const category of categories) {
    list.push({ path: `/categories/${category.slug}`, lastmod: today, priority: '0.7' })
  }
  for (const tag of tags) {
    list.push({ path: `/tags/${tag.slug}`, lastmod: today, priority: '0.5' })
  }
  // A draft collection answers 404, so it stays out of the sitemap for the same
  // reason a hidden listing does.
  for (const collection of collections) {
    if (collection.status === 'draft') continue
    list.push({ path: `/collections/${collection.slug}`, lastmod: today, priority: '0.6' })
  }
  // Makers are derived from tools, so the slug set depends on locale-insensitive
  // fields only — 'en' here just picks the display name, not the slug.
  for (const maker of allMakers('en', [], overrides)) {
    list.push({ path: `/makers/${maker.slug}`, lastmod: today, priority: '0.5' })
  }

  // Blog posts are deliberately absent: the two posts that ship with this
  // build are demo content, and the nav entry is hidden. The `/blog` routes
  // still exist so publishing can be switched on without a redeploy, but until
  // there is real writing to index, advertising it would only ask Google to
  // crawl placeholder text.

  // The weekly archive has no per-week route yet, so only the current board is
  // listed; `weeks` is still touched here so a future /weekly/<id> route is a
  // one-line addition rather than a refactor.
  void weeks

  // Approved submissions are real pages too, and a page that is missing from
  // the sitemap is one a crawler only finds by luck.
  for (const tool of published) {
    if (!visible(tool.slug)) continue
    list.push({ path: `/tools/${tool.slug}`, lastmod: tool.created_at, priority: '0.8' })
  }

  // Only makers the curated index does not already list: a submission from a
  // maker who is already there belongs on the existing page, and listing the
  // same URL twice is a sitemap error.
  const known = new Set(allMakers('en', [], overrides).map((maker) => maker.slug))
  const extra = published.filter((tool) => visible(tool.slug)).map((tool) => localizeTool(tool, 'en'))
  for (const maker of allMakers('en', extra, overrides)) {
    if (known.has(maker.slug)) continue
    list.push({ path: `/makers/${maker.slug}`, lastmod: today, priority: '0.5' })
  }

  return list
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')

  const urls: string[] = []

  for (const entry of await entries(event)) {
    const en = `${SITE}${entry.path === '/' ? '/' : entry.path}`
    const zh = `${SITE}/zh${entry.path === '/' ? '/' : entry.path}`

    // Each language variant lists the full alternate set, including itself —
    // that is what the hreflang spec expects and what Search Console checks.
    const alternates = [
      `<xhtml:link rel="alternate" hreflang="en" href="${escapeXml(en)}"/>`,
      `<xhtml:link rel="alternate" hreflang="zh-Hans" href="${escapeXml(zh)}"/>`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(en)}"/>`,
    ].join('')

    for (const loc of [en, zh]) {
      urls.push(
        `<url><loc>${escapeXml(loc)}</loc>` +
          (entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : '') +
          `<priority>${entry.priority}</priority>` +
          alternates +
          `</url>`,
      )
    }
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
    'xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
    urls.join('') +
    '</urlset>'
  )
})
