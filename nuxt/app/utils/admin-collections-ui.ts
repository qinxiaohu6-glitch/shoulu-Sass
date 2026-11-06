/**
 * Source `routes/admin/directory/-collections-form.tsx` — the value shape, the
 * empty form and the payload builders, minus the JSX.
 */

export interface DirCollection {
  id: string
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
  icon: string
  coverUrl: string
  sort: number
  status: string
  toolCount: number
  toolIds: string[]
  createdAt: number
}

export interface ToolOption {
  id: string
  slug: string
  name: string
}

export interface CollectionFormValues {
  slug: string
  name: string
  description: string
  nameZh: string
  descriptionZh: string
  icon: string
  coverUrl: string
  sort: string
  status: string
}

export function emptyCollectionForm(): CollectionFormValues {
  return {
    slug: '',
    name: '',
    description: '',
    nameZh: '',
    descriptionZh: '',
    icon: '',
    coverUrl: '',
    sort: '0',
    status: 'published',
  }
}

export function valuesFromCollection(row: DirCollection): CollectionFormValues {
  return {
    slug: row.slug || '',
    name: row.name || '',
    description: row.description || '',
    nameZh: row.nameZh || '',
    descriptionZh: row.descriptionZh || '',
    icon: row.icon || '',
    coverUrl: row.coverUrl || '',
    sort: String(row.sort ?? 0),
    status: row.status === 'draft' ? 'draft' : 'published',
  }
}

export function toCollectionPayload(value: CollectionFormValues) {
  return {
    slug: value.slug.trim() || undefined,
    name: value.name.trim(),
    // Always send (incl. '') so clearing EN/ZH copy reaches the API.
    description: value.description.trim(),
    nameZh: value.nameZh.trim(),
    descriptionZh: value.descriptionZh.trim(),
    icon: value.icon.trim(),
    coverUrl: value.coverUrl.trim(),
    sort: Number(value.sort) || 0,
    status: value.status === 'draft' ? 'draft' : 'published',
  }
}

/** Edit omits slug — public collection URLs stay stable after create. */
export function toCollectionEditPayload(value: CollectionFormValues) {
  const { slug: _slug, ...rest } = toCollectionPayload(value)
  return rest
}
