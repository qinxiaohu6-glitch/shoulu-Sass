/**
 * Which sprite glyph a collection card shows.
 *
 * The console stores a free-text icon name, and the sprite only carries the
 * glyphs the site actually uses. So the operator's value is used when it names
 * a glyph we have, and otherwise a keyword match on the icon and the slug picks
 * a sensible one — a collection called "best-coding-tools" with no icon set
 * still gets a code glyph rather than a blank square.
 *
 * The fallback matters: an unknown `<use href>` renders nothing at all, which
 * looks like a layout bug rather than a missing setting.
 */

/** Must stay in sync with the symbols in `components/IconSprite.vue`. */
const SPRITE_ICONS = new Set([
  'home', 'layout-dashboard', 'life-buoy', 'more-vertical', 'upload', 'activity',
  'arrow-left', 'arrow-right', 'arrow-up', 'arrow-up-right', 'calendar', 'check',
  'chevron-down', 'chevron-left', 'chevron-right', 'circle-check', 'clock', 'code',
  'compass', 'credit-card', 'gauge', 'globe', 'image', 'inbox', 'info', 'minus',
  'layout-grid', 'link', 'message-square', 'moon', 'panel-left', 'plus', 'receipt',
  'search', 'shapes', 'shield-check', 'sparkles', 'sun', 'trophy', 'user',
])

export function collectionIcon(icon?: string | null, slug = ''): string {
  const raw = String(icon ?? '').trim().toLowerCase()
  if (SPRITE_ICONS.has(raw)) return raw

  // No video or audio glyph in the sprite, so those two fall through to the
  // generic shapes/sparkles rather than being mapped to something misleading.
  const name = `${raw} ${slug}`.toLowerCase()
  if (/code|dev|engineer|program/.test(name)) return 'code'
  if (/image|design|art|photo|picture/.test(name)) return 'image'
  if (/chat|bot|assistant|conversation/.test(name)) return 'message-square'
  if (/search|research|answer/.test(name)) return 'search'
  if (/write|writing|copy|content/.test(name)) return 'shapes'
  if (/product|workflow|automat/.test(name)) return 'layout-dashboard'
  return 'sparkles'
}
