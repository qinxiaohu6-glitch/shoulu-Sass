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

/**
 * The brand as a search engine should print it. One constant, because the site
 * name in `og:site_name`, in `WebSite.name` and in the visible header have to
 * agree — Google reads all three when it decides what to print above a result.
 */
export const SCHEMA_SITE_NAME = 'dirtool'

export type SiteIdentity = {
  name: string
  /** Absolute URL of the site root. */
  url: string
  /** Absolute URL of a square logo, at least 112px, that the site really serves. */
  logo: string
  sameAs?: string[]
  email?: string
}

/**
 * The site itself: one `Organization` and one `WebSite`, joined by `@id`.
 *
 * `WebSite` on the homepage is what Google reads to decide the site name it
 * prints above a result — `og:site_name` is for social cards, not for this.
 * Without it a directory competes for its own brand name against its own pages.
 *
 * No `potentialAction` searchbox: the site has no search URL to point one at,
 * and Google retired the sitelinks searchbox. Marking up a feature that no
 * longer exists is worse than leaving it out.
 *
 * Nothing here is invented. No address, no founding date, no company type:
 * `LEGAL_NAME` is still a brand-level placeholder, and a fabricated registered
 * entity is a false claim in machine-readable form.
 */
export function siteEntitySchema(identity: SiteIdentity) {
  const organizationId = `${identity.url}#organization`
  const websiteId = `${identity.url}#website`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: identity.name,
        url: identity.url,
        logo: { '@type': 'ImageObject', url: identity.logo },
        ...(identity.sameAs?.length ? { sameAs: identity.sameAs } : {}),
        ...(identity.email ? { email: identity.email } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        name: identity.name,
        url: identity.url,
        publisher: { '@id': organizationId },
      },
    ],
  }
}

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
