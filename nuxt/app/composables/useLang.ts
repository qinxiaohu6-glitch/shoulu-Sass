import type { Locale } from '~~/shared/types/catalog'

/**
 * Every page needs the same three things: the resolved locale, a boolean for
 * copy that is still written inline rather than in the i18n files, and `pick`
 * for choosing between two literals in a template.
 *
 * `pick` is a plain function, not a computed — callers invoke it during render,
 * and it re-evaluates because `isZh` is reactive.
 */
export function useLang() {
  const { locale, t, locales, setLocale } = useI18n()
  const route = useRoute()

  /**
   * The console is owner-only and always Chinese. `/admin` resolves to `en`
   * under `prefix_except_default`, so the path is checked before the locale:
   * that keeps every console page — nav labels, category names resolved by
   * `localizeCategory`, the submissions queue — on the Chinese side, while
   * the public site keeps following the URL.
   */
  const lang = computed<Locale>(() => {
    if (/^\/(?:zh\/)?admin(?:\/|$)/.test(route.path)) return 'zh'
    return locale.value === 'zh' ? 'zh' : 'en'
  })
  const isZh = computed(() => lang.value === 'zh')

  function pick<T>(zh: T, en: T): T {
    return isZh.value ? zh : en
  }

  return { lang, isZh, pick, t, locale, locales, setLocale }
}
