/**
 * Source `routes/admin/-roles-shared.tsx` — the roles page's vocabulary.
 *
 * The zod schema becomes `isRoleFormValid` (`name` and `title` non-empty),
 * matching the one validation function style the rest of this port uses.
 */

export interface Role {
  id: string
  name: string
  title: string
  description: string | null
  status: string
}

export interface Permission {
  id: string
  code: string
  title: string
}

export const ROLES_PAGE_SIZE = 20

export interface RoleForm {
  name: string
  title: string
  description: string
}

export function emptyRoleForm(): RoleForm {
  return { name: '', title: '', description: '' }
}

/** `z.object({ name: z.string().min(1), title: z.string().min(1), description: z.string() })`. */
export function isRoleFormValid(form: RoleForm): boolean {
  return Boolean(form.name.trim() && form.title.trim())
}
