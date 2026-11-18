/**
 * JSON-LD builders.
 *
 * The competitor ships `ItemList` on the board, `FAQPage` on every page that
 * answers questions, and `BreadcrumbList` on sub-pages. These are the pieces
 * that let a search result show a sitelink trail, a question accordion or a
 * list of launches instead of a plain blue link.
 *
 * Every builder takes plain data and returns a plain object, so the caller
 * keeps owning the copy. Nothing here invents a claim: an `ItemList` only ever
 * contains rows the page already renders.
 */

export const SCHEMA_SITE = 'https://dirtool.com'

export type FaqPair = { question: string; answer: string }

export function faqPageSchema(pairs: FaqPair[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs
      .filter((pair) => pair.question.trim() && pair.answer.trim())
      .map((pair) => ({
        '@type': 'Question',
        name: pair.question.trim(),
        acceptedAnswer: { '@type': 'Answer', text: pair.answer.trim() },
      })),
  }
}

export type Crumb = { name: string; path: string }

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${SCHEMA_SITE}${crumb.path}`,
    })),
  }
}

export type ListEntry = { name: string; path: string; position?: number }

/**
 * A ranked board. `position` defaults to array order, which is what a board
 * means; pass it only when the page skips rows (it never should).
 */
export function itemListSchema(name: string, entries: ListEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: entry.position ?? index + 1,
      name: entry.name,
      url: `${SCHEMA_SITE}${entry.path}`,
    })),
  }
}
