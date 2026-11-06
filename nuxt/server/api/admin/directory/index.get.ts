/**
 * GET /api/admin/directory — everything the four console pages edit.
 *
 * One payload rather than four endpoints: the dataset is thirty listings, eight
 * categories, fifteen tags and however many collections an editor has written,
 * so splitting it would buy four round trips and nothing else. It also means
 * the console can cross-reference — the collection editor needs the tool list
 * to pick from, and the tool editor needs the category list to choose from —
 * without a second request.
 *
 * Answers 404 without the token, like every other admin route: an unauthorised
 * scanner should not learn that an editor exists.
 */

import { isAdmin } from '../../../utils/admin'
import { useDb } from '../../../utils/db'
import {
  directoryToolSlugs,
  listDirectoryCategories,
  listDirectoryCollections,
  listDirectoryTags,
  listDirectoryTools,
} from '../../../utils/directory'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')

  if (!isAdmin(event)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const db = await useDb(event)

  const [tools, categories, tags, collections, inDb] = await Promise.all([
    listDirectoryTools(db),
    listDirectoryCategories(db, true),
    listDirectoryTags(db),
    listDirectoryCollections(db),
    directoryToolSlugs(db),
  ])

  return {
    ok: true,
    tools: tools.map((tool) => ({ tool, source: inDb.has(tool.slug) ? 'db' : 'catalog' })),
    categories,
    tags,
    collections,
    stats: {
      tools: tools.length,
      categories: categories.filter((c) => c.status !== 'deleted').length,
      tags: tags.length,
      collections: collections.length,
      featured: tools.filter((t) => t.is_featured).length,
      paid: tools.filter((t) => t.is_paid).length,
      // A listing whose `status` is anything other than `published` is off the
      // site — the console counts them so "where did it go" has an answer.
      unpublished: tools.filter((t) => t.status !== 'approved').length,
      overrides: tools.filter((t) => inDb.has(t.slug)).length,
    },
  }
})
