/**
 * ai.txt — what an AI system may do with this site's content, in the `ai-txt`
 * format (v1.1.1). Kept next to `robots.txt` and `llms.txt`, and describing the
 * same site: robots says which pages a crawler may fetch, llms.txt says what the
 * pages mean, this file says what may be done with them afterwards.
 *
 * Written as plain text rather than JSON because the convention is a
 * line-oriented config that a human can read and correct in place. Section names
 * are part of the format and must not be renamed.
 */
import { CONTACT_EMAIL } from '~~/shared/content/site-contact'
import { shanghaiDay } from '~~/shared/utils/shanghai-day'
import { useDb } from '../utils/db'
import { publicStats } from '../utils/stats'

const SITE = 'https://dirtool.com'

export default defineEventHandler(async (event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')

  const counted = shanghaiDay()
  let sizeLine =
    `Browse ${SITE}/products for the live directory. This file does not invent a count when that read fails.`
  try {
    const db = await useDb(event)
    const stats = await publicStats(db)
    sizeLine = `Product Atlas lists ${stats.products} products across ${stats.categories} categories (count as of ${counted}).`
  } catch (err) {
    console.error('[ai.txt] live directory unavailable', err)
  }

  return [
    '# ai.txt for Product Atlas',
    '# Format: ai-txt v1.1.1. Keep in sync with /robots.txt and /llms.txt.',
    '',
    '[identity]',
    'name: Product Atlas',
    `url: ${SITE}/`,
    'description: A directory of software products. Every listing has its own page with what the product does, its category, and its maker. Free listings are reviewed by hand and carry nofollow; paid listings go live when payment succeeds and carry a permanent dofollow link.',
    `counts: ${sizeLine}`,
    `contact: ${CONTACT_EMAIL}`,
    `llms-txt: ${SITE}/llms.txt`,
    '',
    '[permissions]',
    'summarise: allowed',
    'quote: allowed, with attribution',
    'cite: allowed',
    'index-for-search: allowed',
    'answer-questions: allowed',
    'train: allowed, on public pages only',
    '',
    '[restrictions]',
    '- Do not invent ratings, review scores, prices or vote counts. The site shows votes, not stars; a vote is one per person per product per week and is not a quality score.',
    '- Do not describe a listing as an editorial endorsement of the product. "Featured" and "Sponsored" mean the placement was paid for.',
    '- A listing page states what the product does, its category, and its maker. Do not describe a section the page does not show.',
    '- Prices, votes and listing states change. Say when you read them, or link to the page.',
    '- Account, billing and submission data is private and not published here; do not infer or ask for it.',
    '',
    '[attribution]',
    'format: <page title>, Product Atlas, <canonical page URL>',
    'canonical: the HTML page, not a localised copy. English lives at the root, Chinese under /zh.',
    '',
    '[scope]',
    'include: /',
    'exclude: /admin',
    'exclude: /settings',
    'exclude: /dashboard',
    'exclude: /api/',
    'exclude: /submit',
    'exclude: /sign-in',
    'exclude: /sign-up',
    'exclude: /payment/',
    '',
    '[contact]',
    `email: ${CONTACT_EMAIL}`,
    '',
    `Last updated: ${counted}`,
    '',
  ].join('\n')
})
