/**
 * Wire `/api/audit` to Nitro's in-process fetch for this Worker's own hosts.
 *
 * A service binding back to this Worker would only re-enter the Cloudflare
 * fetch handler, and that handler's next line is `localFetch(pathname)`.
 * Calling it here skips the public `fetch` the edge answers with 522, and it
 * does not need a new wrangler binding. `audit()` itself stays free of Nitro
 * imports so the host routing can be tested as plain TypeScript.
 *
 * The context copy matches `cloudflare-module`'s fetch handler: the nested
 * page, `robots.txt` and `sitemap.xml` read D1 from `_platform.cloudflare`.
 * Dropping it would fall through to `node:sqlite`, which does not exist on
 * Workers.
 */

import type { H3Event } from 'h3'
import { audit, type AuditLang, type AuditOptions } from './audit'

export function auditForRequest(event: H3Event, rawUrl: string, lang: AuditLang) {
  const ctx = event.context as {
    waitUntil?: (promise: Promise<unknown>) => void
    _platform?: unknown
    cloudflare?: unknown
  }
  const context = {
    waitUntil: ctx.waitUntil,
    _platform: ctx._platform ?? (ctx.cloudflare ? { cloudflare: ctx.cloudflare } : undefined),
  }
  const localFetch = useNitroApp().localFetch
  const options: AuditOptions = {
    requestHost: getRequestURL(event).hostname,
    localFetch: (path, init) => localFetch(path, { ...init, context } as RequestInit),
  }
  return audit(rawUrl, lang, options)
}
