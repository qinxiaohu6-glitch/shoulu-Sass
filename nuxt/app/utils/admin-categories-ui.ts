/**
 * Source `routes/admin/-categories-page.tsx` — the row shape, the form and the
 * page's constants.
 */

export interface AdminCategory {
  id: string
  slug: string
  title: string
  description: string | null
  status: string
  createdAt: string
}

export const CATEGORIES_PAGE_SIZE = 20

export interface CategoryForm {
  slug: string
  title: string
  description: string
}

/** Source `emptyForm`. */
export function emptyCategoryForm(): CategoryForm {
  return { slug: '', title: '', description: '' }
}

/** Source `categorySchema`: `slug` and `title` are required, description is not. */
export function isCategoryFormValid(form: CategoryForm) {
  return form.slug.trim().length > 0 && form.title.trim().length > 0
}
