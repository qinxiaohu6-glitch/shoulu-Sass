/**
 * Product document titles.
 *
 * A product page's title has room for two things: the product's name and its
 * one-line description. Both are what someone typed, or would type, into a
 * search box. Everything else is page furniture.
 *
 * Two things were in there and should not have been:
 *
 *  * Section names. Titles ended with `— Features, Pricing, Related`, which is
 *    the page's own table of contents. Nobody searches for "Related", and the
 *    tail pushed the description past the cut, so the useful half of the title
 *    never reached the result at all.
 *  * The brand suffix. ` | dirtool` costs 16 of the ~60 characters a
 *    result shows. Keeping it left roughly 30 for the description — not enough
 *    to say anything — so on product pages the name and the description keep
 *    the whole budget. The site name still reaches a result through
 *    `og:site_name` and the homepage `WebSite` markup, which is the signal
 *    Google actually reads for it.
 *
 * The budget is measured in display width, not characters: a Chinese character
 * takes two Latin ones in a result, so a Chinese title gets half as many
 * characters before it is cut.
 */

/** Roughly what a search result shows before it truncates, in Latin characters. */
export const TITLE_MAX_WIDTH = 60

/**
 * Characters that occupy two columns: CJK ideographs, kana, Hangul, and the
 * full-width forms. Everything else counts as one.
 */
const WIDE =
  /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/

/** Display width of one code point. */
function charWidth(ch: string): number {
  return WIDE.test(ch) ? 2 : 1
}

/** Display width of a string, the unit the title budget is spent in. */
export function textWidth(text: string): number {
  let width = 0
  for (const ch of text) width += charWidth(ch)
  return width
}

/**
 * Cut to a width, preferring a word boundary.
 *
 * A Latin sentence is cut at the last space when one falls in the back half of
 * the slice, because "for writing, research…" reads and "for writing, resear…"
 * does not. A Chinese sentence has no spaces to cut at, so it is cut where the
 * budget runs out — trailing punctuation is dropped either way, since a comma
 * or a dash before an ellipsis looks like a typo.
 */
function fit(text: string, budget: number): string {
  let out = ''
  let width = 0
  for (const ch of text) {
    const next = charWidth(ch)
    if (width + next > budget) break
    out += ch
    width += next
  }
  const space = out.lastIndexOf(' ')
  if (space > out.length * 0.6) out = out.slice(0, space)
  return out.replace(/[\s,;:.·—–\-，、。；：]+$/u, '')
}

/**
 * `Name — one-liner`, cut so the whole thing fits a result.
 *
 * A name long enough to eat the budget keeps the title to itself: half a
 * description is worse than none.
 */
export function listingDocumentTitle(name: string, oneLiner: string): string {
  const clean = name.replace(/\s+/g, ' ').trim()
  const line = oneLiner.replace(/\s+/g, ' ').trim()
  if (!line) return clean

  const head = `${clean} — `
  const budget = TITLE_MAX_WIDTH - textWidth(head)
  if (budget < 20) return clean
  if (textWidth(line) <= budget) return head + line

  const cut = fit(line, budget - 1)
  return cut ? `${head}${cut}…` : clean
}
