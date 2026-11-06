/**
 * Source `shipany-dir/src/hooks/use-confirm.tsx`.
 *
 * A promise-based replacement for `window.confirm`, rendered with the app's
 * `Dialog`. Render `<ConfirmDialog>` once per page with `v-bind` of `options`
 * and `@confirm`/`@cancel` wired to `settle`, then
 * `if (!(await confirm({ title }))) return;`.
 *
 * The Vue version returns the state instead of a rendered element: a composable
 * cannot own markup. `options` is deliberately kept after closing so the text
 * does not blank out mid-animation — the same reason the source keeps it.
 */
import { computed, ref } from 'vue'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export function useConfirm() {
  const { t } = useSettingsI18n()

  const open = ref(false)
  const options = ref<ConfirmOptions | null>(null)
  let resolveRef: ((ok: boolean) => void) | null = null

  function confirm(opts: ConfirmOptions) {
    resolveRef?.(false)
    options.value = opts
    open.value = true
    return new Promise<boolean>((resolve) => {
      resolveRef = resolve
    })
  }

  function settle(ok: boolean) {
    resolveRef?.(ok)
    resolveRef = null
    open.value = false
  }

  /** Labels resolved the way the source resolves them: caller first, then the
   *  shared `common.confirm.*` defaults. */
  const labels = computed(() => ({
    confirmLabel: options.value?.confirmLabel ?? t('common.confirm.ok'),
    cancelLabel: options.value?.cancelLabel ?? t('common.confirm.cancel'),
  }))

  return { confirm, open, options, settle, labels }
}
