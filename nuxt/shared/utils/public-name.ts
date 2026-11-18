/**
 * Visible product name.
 *
 * People submit a page title, not a product name:
 *   "ClockZone — the team calendar that finally respects time zones"
 *   "Free Anonymous Video Chat with Strangers | OmeWisp"
 * A card that prints all of that wraps to three lines and pushes everything
 * else around. This keeps the product name and drops the rest.
 *
 * The name is not always the first segment. It is the segment that does not
 * read like a sentence — so both of these resolve correctly:
 *   "MielaChat - Meet Verified Latinas on Live Map | Private 1v1" -> "MielaChat"
 *   "Free Anonymous Video Chat with Strangers | OmeWisp"         -> "OmeWisp"
 *
 * Rules, in order:
 *   1. A trailing role ("Team", "Support") is not the product.
 *   2. Split on a spaced separator (| — – · :: -) or a colon. A segment that
 *      reads like a sentence is a tagline; the first segment that does not is
 *      the name.
 *   3. If no segment reads like a tagline the whole title is the name, so
 *      "Notion – AI" and "Claude 3.5: Sonnet" survive untouched.
 *   4. Anything still over `max` characters is cut with an ellipsis.
 *
 * The stored slug and the stored row are left alone; this only changes what a
 * page prints.
 */
const ROLE_SUFFIX = /^(.*\S)\s+(?:Team|Support)$/i
/** A spaced separator. A bare hyphen inside a word is not one. */
const SEPARATOR = /\s+(?:\||—|–|·|::)\s+|\s+-\s+|[:：]\s+/
/**
 * Words that almost never appear in a product name but do appear in a
 * tagline. Deliberately short: a false positive here only costs a word.
 */
const SENTENCE_WORDS = new Set([
  'a', 'an', 'the', 'with', 'for', 'your', 'you', 'that', 'and', 'of', 'to',
  'in', 'on', 'at', 'by', 'from', 'is', 'are', 'this', 'these', 'those',
  'our', 'we', 'how', 'why', 'what', 'when', 'every', 'all', 'but', 'into',
])
/** Below this many characters a segment is a name even if it has a stopword. */
const SHORT_SEGMENT = 16
export const PRODUCT_NAME_MAX = 44

function readsLikeSentence(segment: string): boolean {
  const words = segment.split(/\s+/)
  if (words.length >= 4) return true
  if (segment.length >= 24) return true
  if (segment.length <= SHORT_SEGMENT) return false
  return words.some((word) => SENTENCE_WORDS.has(word.toLowerCase().replace(/[^a-z]/g, '')))
}

export function publicProductName(name: string, max = PRODUCT_NAME_MAX): string {
  let value = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (!value) return ''

  const role = value.match(ROLE_SUFFIX)
  if (role) {
    const base = role[1]!.trim()
    if (base.length >= 2) value = base
  }

  const segments = value
    .split(SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean)
  if (segments.length > 1 && segments.some(readsLikeSentence)) {
    const hit = segments.find((part) => part.length >= 2 && !readsLikeSentence(part))
    if (hit) value = hit
  }

  if (max > 1 && value.length > max) value = `${value.slice(0, max - 1).trimEnd()}…`
  return value
}
