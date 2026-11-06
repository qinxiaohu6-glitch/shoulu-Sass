/**
 * Helpers behind `/admin/settings` — source `routes/admin/-settings-field.tsx`.
 *
 * The registry (`admin-settings-registry.ts`) says *what* a field is; this file
 * holds the few names the page needs to special-case it.
 */
import { APPEARANCE_ENABLED_KEY, COLOR_MODE_CONFIG_KEY, type AppearanceKey } from './admin-appearance'
import { tiers } from '~~/shared/content/pricing'

/** Saved secrets come back masked with this prefix (see the source's service). */
export const MASKED_PREFIX = '••••••••'

/** One row of the "Custom" tab: a key the registry does not know, and its value. */
export interface CustomRow {
  key: string
  value: string
}

// Appearance settings render as chip pickers instead of a plain select.
export const ADMIN_APPEARANCE_FIELDS: Record<string, AppearanceKey> = {
  app_theme: 'theme',
  app_font: 'font',
  app_font_size: 'fontSize',
  app_sidebar_variant: 'sidebarVariant',
  app_sidebar_collapsible: 'sidebarCollapsible',
}

// Saved as soon as they change, without the Save button.
export const INSTANT_SETTINGS = new Set([
  APPEARANCE_ENABLED_KEY,
  ...Object.keys(ADMIN_APPEARANCE_FIELDS),
  COLOR_MODE_CONFIG_KEY,
  'user_theme_enabled',
])

/**
 * The three providers take a JSON map of product id → provider product id.
 * The source builds the sample from its pricing catalog; this build sells the
 * six plans in `shared/content/pricing.ts`, so those are the ids it lists.
 */
export function productIdsMappingPlaceholder(samplePrefix: string): string {
  return JSON.stringify(
    Object.fromEntries(tiers.map((tier) => [tier.id, `${samplePrefix}${tier.id}`])),
    null,
    2,
  )
}

/** `admin.settings.tips.<name>` — the source's per-field help text. */
export function settingTipKey(name: string) {
  return `admin.settings.tips.${name}`
}
