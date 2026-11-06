import { DIRECTORY_COPY, type DirectoryCopyKey } from '~/utils/directory-copy'

/**
 * The source's `m['key']()` call, in one line.
 *
 * `DIRECTORY_COPY` holds the pair; this picks the active language and fills the
 * `{placeholders}`. Paraglide interpolates the same way, so the strings in
 * `directory-copy.ts` can stay byte-identical to the source's.
 *
 * Returned as a plain function rather than a `computed` factory because the
 * language is read at call time — the same contract `pick()` has, and the reason
 * a page can call `t(...)` inside a template and have it re-render on a locale
 * switch.
 */
export type DirectoryCopyParams = Record<string, string | number>

export function useDirectoryCopy() {
  const { lang } = useLang()

  return function copy(key: DirectoryCopyKey, params?: DirectoryCopyParams): string {
    const pair = DIRECTORY_COPY[key]
    const raw = lang.value === 'zh' ? pair.zh : pair.en
    if (!params) return raw
    return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in params ? String(params[name]) : whole,
    )
  }
}
