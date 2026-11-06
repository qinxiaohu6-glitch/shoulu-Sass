/**
 * Source `routes/admin/directory/-categories-form.tsx` — the value shape, the
 * empty form and the two payload builders.
 *
 * Kept out of the component because the page and the field set both need them,
 * exactly as the source splits them into `-categories-form.tsx`.
 */

export interface DirCategory {
  id: string
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
  icon: string
  sort: number
  status: string
  toolCount: number
  createdAt: number
}

export interface DirectoryFormValues {
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
  icon: string
  sort: string
  status: string
}

export function emptyCategoryForm(): DirectoryFormValues {
  return {
    slug: '',
    name: '',
    description: '',
    nameZh: '',
    descriptionZh: '',
    icon: '',
    sort: '0',
    status: 'published',
  }
}

export function valuesFromCategory(row: DirCategory): DirectoryFormValues {
  return {
    slug: row.slug || '',
    name: row.name || '',
    description: row.description || '',
    nameZh: row.nameZh || '',
    descriptionZh: row.descriptionZh || '',
    icon: row.icon || '',
    sort: String(row.sort ?? 0),
    status: row.status === 'draft' ? 'draft' : 'published',
  }
}

export function toCategoryPayload(value: DirectoryFormValues) {
  return {
    slug: value.slug.trim() || undefined,
    name: value.name.trim(),
    // Always send (incl. '') so clearing EN/ZH copy reaches the API.
    description: value.description.trim(),
    nameZh: value.nameZh.trim(),
    descriptionZh: value.descriptionZh.trim(),
    icon: value.icon.trim(),
    sort: Number(value.sort) || 0,
    status: value.status === 'draft' ? 'draft' : 'published',
  }
}

/** Edit omits slug — public category URLs stay stable after create. */
export function toCategoryEditPayload(value: DirectoryFormValues) {
  const { slug: _slug, ...rest } = toCategoryPayload(value)
  return rest
}
