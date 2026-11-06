/**
 * Appearance presets — source `shipany-dir/src/config/appearance.ts`, reduced to
 * the constants the settings registry and the settings page read.
 *
 * The source also uses this module to paint `<html>` (`appearanceStyle`) and to
 * resolve the site's appearance in its root loader. This build ships one fixed
 * design — the palettes live in `assets/css/main.css` and there is no theme
 * engine — so nothing here is applied; the admin page stores the choice, and
 * the endpoints say why that choice has no effect yet.
 */

export const THEMES = [
  { id: 'classic', swatch: 'oklch(0.22 0.005 60)' },
  { id: 'forest', swatch: 'oklch(0.52 0.12 150)' },
  { id: 'ocean', swatch: 'oklch(0.5 0.15 255)' },
  { id: 'violet', swatch: 'oklch(0.48 0.17 290)' },
  { id: 'sunset', swatch: 'oklch(0.58 0.16 42)' },
  { id: 'rose', swatch: 'oklch(0.54 0.18 10)' },
  { id: 'slate', swatch: 'oklch(0.3 0.03 260)' },
] as const

export const FONTS = [
  { id: 'inter', stack: "'Inter Variable', 'Inter', sans-serif" },
  {
    id: 'system',
    stack:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  },
  {
    id: 'rounded',
    stack: "'Nunito Variable', ui-rounded, 'SF Pro Rounded', sans-serif",
  },
  {
    id: 'serif',
    stack:
      "'Source Serif 4 Variable', ui-serif, Georgia, 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif",
  },
] as const

export const FONT_SIZES = [
  { id: 'sm', scale: '93.75%' },
  { id: 'md', scale: '100%' },
  { id: 'lg', scale: '107.5%' },
] as const

export const SIDEBAR_VARIANTS = [{ id: 'inset' }, { id: 'floating' }, { id: 'sidebar' }] as const

export const SIDEBAR_COLLAPSIBLES = [{ id: 'offcanvas' }, { id: 'icon' }] as const

export const COLOR_MODES = [{ id: 'system' }, { id: 'light' }, { id: 'dark' }] as const

export const COLOR_MODE_CONFIG_KEY = 'app_color_mode'

export type ThemeId = (typeof THEMES)[number]['id']
export type FontId = (typeof FONTS)[number]['id']
export type FontSizeId = (typeof FONT_SIZES)[number]['id']
export type SidebarVariantId = (typeof SIDEBAR_VARIANTS)[number]['id']
export type SidebarCollapsibleId = (typeof SIDEBAR_COLLAPSIBLES)[number]['id']
export type ColorModeId = (typeof COLOR_MODES)[number]['id']

export interface Appearance {
  theme: ThemeId
  font: FontId
  fontSize: FontSizeId
  sidebarVariant: SidebarVariantId
  sidebarCollapsible: SidebarCollapsibleId
}
export type AppearanceKey = keyof Appearance

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'classic',
  font: 'inter',
  fontSize: 'md',
  sidebarVariant: 'inset',
  sidebarCollapsible: 'offcanvas',
}

/** Master switch: 'true' turns the admin's appearance settings on. */
export const APPEARANCE_ENABLED_KEY = 'appearance_enabled'

/** One appearance part: its option list, its label key and its swatch/font. */
export function appearanceOptions(key: AppearanceKey) {
  switch (key) {
    case 'theme':
      return THEMES.map((t) => ({ id: t.id, labelKey: `common.themes.${t.id}`, swatch: t.swatch }))
    case 'font':
      return FONTS.map((f) => ({
        id: f.id,
        labelKey: `common.fonts.${f.id}`,
        fontFamily: f.stack,
      }))
    case 'fontSize':
      return FONT_SIZES.map((s) => ({ id: s.id, labelKey: `common.font_sizes.${s.id}` }))
    case 'sidebarVariant':
      return SIDEBAR_VARIANTS.map((v) => ({
        id: v.id,
        labelKey: `common.sidebar_variants.${v.id}`,
      }))
    case 'sidebarCollapsible':
      return SIDEBAR_COLLAPSIBLES.map((v) => ({
        id: v.id,
        labelKey: `common.sidebar_collapsibles.${v.id}`,
      }))
  }
}

export function colorModeOptions() {
  return COLOR_MODES.map((c) => ({ id: c.id, labelKey: `common.color_modes.${c.id}` }))
}
