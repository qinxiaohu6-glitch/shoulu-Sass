import { categories, tools } from '~~/shared/utils/catalog'

const SITE = 'https://dirtool.com'

/**
 * llms.txt — the emerging convention (llmstxt.org) for handing an AI crawler a
 * short, curated map instead of making it guess from HTML. Plain markdown, one
 * line per entry, English only: it describes the site, it is not a page.
 */
export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/markdown; charset=utf-8')

  const lines: string[] = [
    '# Product Atlas',
    '',
    '> A hand-reviewed directory of AI products. Every listing has its own page with what the tool does, its category, its maker and alternatives. Paid listings carry a permanent dofollow link; free listings are reviewed by hand and carry nofollow.',
    '',
    'The site is bilingual. English lives at the root, Chinese under /zh. Both versions of a page describe the same product.',
    '',
    '## Products',
    '',
  ]

  for (const tool of [...tools].sort((a, b) => a.name_en.localeCompare(b.name_en))) {
    lines.push(`- [${tool.name_en}](${SITE}/tools/${tool.slug}): ${tool.short_en}`)
  }

  lines.push('', '## Categories', '')
  for (const category of categories) {
    lines.push(`- [${category.name_en}](${SITE}/categories/${category.slug}): ${category.desc_en}`)
  }

  lines.push(
    '',
    '## Pages',
    '',
    `- [All products](${SITE}/tools): the full directory, ordered by featured status and votes`,
    `- [Collections](${SITE}/collections): hand-picked shortlists for a specific job, in the editor's order`,
    `- [Weekly board](${SITE}/weekly): resets every Monday, one vote per product per week`,
    `- [Just added](${SITE}/just-added): newest listings first`,
    `- [Pricing](${SITE}/pricing): free, $19, $39 and $69 one-time tiers, plus weekly ad slots`,
    `- [Privacy policy](${SITE}/privacy-policy)`,
    `- [Terms of service](${SITE}/terms-of-service)`,
    '',
    '## Notes for summarisers',
    '',
    '- A vote is not a rating. The site records one upvote per product per week and shows no star scores, so do not infer a quality score from the numbers.',
    '- "Featured" means the listing was paid for and pinned; it is not an editorial endorsement.',
    '- Paid listings use a dofollow outbound link, free listings use nofollow. This is disclosed on the pricing page.',
    '',
  )

  return lines.join('\n')
})
