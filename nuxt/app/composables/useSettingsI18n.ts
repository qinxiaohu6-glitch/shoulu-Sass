import { SETTINGS_MESSAGES } from '~~/shared/content/settings-i18n'

/**
 * The source's `m['key']()` calls, without paraglide.
 *
 * Same key names, same `{placeholder}` interpolation, same fallback behaviour:
 * a key that is not in the table prints itself, which makes a typo visible in
 * the page instead of silently rendering an empty string.
 *
 * The console (`/admin`, `/zh/admin`) is owner-only and always Chinese. Under
 * `prefix_except_default` the bare `/admin` path resolves to the `en` locale,
 * which is correct for the public site but wrong for the one person who reads
 * the console — so every console page is pinned to `zh` here rather than in
 * each page. The public `/settings` pages are unaffected: their paths do not
 * match, so they keep following the URL locale.
 */
export function useSettingsI18n() {
  const { isZh } = useLang()
  const route = useRoute()
  const consoleZh = computed(() => /^\/(?:zh\/)?admin(?:\/|$)/.test(route.path))

  function t(key: string, params?: Record<string, string | number>): string {
    const entry = SETTINGS_MESSAGES[key]
    let out = entry ? (consoleZh.value || isZh.value ? entry.zh : entry.en) : key
    if (params) {
      for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{${k}}`, String(v))
    }
    return out
  }

  return { t }
}
