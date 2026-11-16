/**
 * Visible product name. A trailing role such as "Team" or "Support" is not
 * the product. The stored slug is left alone; this only changes what a page
 * prints, and what a new draft keeps as the name.
 */
const ROLE_SUFFIX = /^(.*\S)\s+(?:Team|Support)$/i

export function publicProductName(name: string): string {
  const trimmed = String(name ?? '').trim()
  const match = trimmed.match(ROLE_SUFFIX)
  if (!match) return trimmed
  const base = match[1]!.trim()
  return base.length >= 2 ? base : trimmed
}
