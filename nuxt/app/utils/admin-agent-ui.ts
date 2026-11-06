/**
 * Shapes and helpers for `/admin/agent` — source `routes/admin/agent.tsx`,
 * `-agent-accounts.tsx`, `-agent-account-keys.tsx` and `-agent-logs.tsx`.
 *
 * The source splits these across four files because React needs a module per
 * component; Vue only needs the types and the pure functions, so the labels
 * that need `t()` stay in the components that render them.
 */

/** One admin API key (`sa_admin_…`). Only the hash is stored. */
export interface AgentKey {
  id: string
  name: string
  keyPrefix: string
  status: string
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
}

/** An `api`-type user: its permissions are the RBAC roles it holds. */
export interface Agent {
  id: string
  name: string
  createdAt: string
  roles: { id: string; name: string; title: string }[]
  keys: AgentKey[]
}

/** A role row from `/api/admin/roles` (the same shape `/admin/roles` uses). */
export interface AgentRole {
  id: string
  name: string
  title: string
  description?: string | null
}

/** One audited call an agent made with its key. */
export interface AgentExecution {
  id: string
  userId: string
  userName: string | null
  tokenId: string | null
  keyName: string | null
  keyPrefix: string | null
  operation: string
  targetId: string | null
  status: string
  createdAt: string
  completedAt: string | null
}

/** `PAGE_TABS` in `agent.tsx`; `?tab=` carries the second and third. */
export const AGENT_PAGE_TABS = ['accounts', 'connect', 'logs'] as const
export type AgentPageTab = (typeof AGENT_PAGE_TABS)[number]

/** `EXPIRY_DAYS` in `-agent-account-keys.tsx`. */
export const AGENT_EXPIRY_DAYS = ['7', '30', '90', '365', 'never'] as const

/** `PAGE_SIZE` in `-agent-logs.tsx`. */
export const AGENT_LOGS_PAGE_SIZE = 20

/** `ALL` in `-agent-logs.tsx`: the "every agent" option of the filter. */
export const AGENT_LOGS_ALL = '__all__'

/**
 * The site's name, used for two things in the source: the `{app}` placeholder
 * of the skill prompt, and the localhost branch of `projectSlug`. This build has
 * no `app_name` config — the wordmark in `useSeo` is the site name.
 */
export const AGENT_APP_NAME = 'Product Atlas'

/**
 * A stable, unique-per-site project name. App names can repeat across projects
 * (e.g. an untouched template), domains can't: "www.myshop.com" → "myshop-com".
 * Locally, the app name plus port, so side-by-side dev sites don't collide.
 */
export function projectSlug(appName: string, origin: string) {
  const clean = (v: string) =>
    v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
  try {
    const url = new URL(origin)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      return clean(url.hostname.replace(/^www\./, ''))
    const base = clean(appName) || 'shipany'
    return url.port ? `${base}-${url.port}` : base
  } catch {
    return clean(appName) || 'shipany'
  }
}

/** A key is only usable while it is `active` *and* not past its expiry. */
export function keyState(k: AgentKey): 'active' | 'expired' | 'revoked' {
  if (k.status !== 'active') return 'revoked'
  if (k.expiresAt && new Date(k.expiresAt) <= new Date()) return 'expired'
  return 'active'
}

export function agentKeyStateVariant(state: 'active' | 'expired' | 'revoked') {
  return state === 'active' ? ('default' as const) : ('secondary' as const)
}

/** Badge variant of a log row's result, matching the source's `StatusBadge`. */
export function agentLogStatusVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'default' as const
    case 'failed':
      return 'destructive' as const
    case 'pending':
      return 'secondary' as const
    default:
      // 'unknown': the call may have had side effects before a crash.
      return 'outline' as const
  }
}

/** i18n key of a log row's result label. */
export function agentLogStatusKey(status: string) {
  switch (status) {
    case 'completed':
      return 'admin.agent.log_completed'
    case 'failed':
      return 'admin.agent.log_failed'
    case 'pending':
      return 'admin.agent.log_pending'
    default:
      return 'admin.agent.log_unknown'
  }
}

/** `duration()` in `-agent-logs.tsx`. */
export function agentDuration(e: AgentExecution) {
  if (!e.completedAt) return '—'
  const ms = new Date(e.completedAt).getTime() - new Date(e.createdAt).getTime()
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}
