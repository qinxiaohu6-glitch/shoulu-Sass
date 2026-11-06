/**
 * Source `routes/admin/permissions.tsx` — the page's vocabulary.
 *
 * The source keeps these inline; they live here so the page file stays the
 * markup and the two validation rules are readable in one place.
 */

export interface PermissionRow {
  id: string
  code: string
  resource: string
  action: string
  title: string
}

export const PERMISSIONS_PAGE_SIZE = 20

export interface PermissionForm {
  code: string
  resource: string
  action: string
  title: string
}

export function emptyPermissionForm(): PermissionForm {
  return { code: '', resource: '', action: '', title: '' }
}

/** Create needs all four fields; edit only code + title (source `handleCreate` / `handleEdit`). */
export function isPermissionFormValid(form: PermissionForm, allFields = true): boolean {
  if (!form.code.trim() || !form.title.trim()) return false
  if (!allFields) return true
  return Boolean(form.resource.trim() && form.action.trim())
}
