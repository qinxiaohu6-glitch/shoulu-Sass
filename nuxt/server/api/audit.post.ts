/**
 * POST /api/audit — fetch a public page and run the 20 on-page checks.
 *
 * Four reads per call (the page, then llms.txt / robots.txt / sitemap.xml).
 * A host other than this Worker is an outbound fetch. This Worker's own
 * hosts are an in-process `localFetch` — a public fetch of the custom domain
 * is answered 522 by the edge, because the zone has no origin behind it.
 * The endpoint is capped either way. The cap is per isolate, which is
 * the honest description of it: Workers spin up many short-lived isolates, so
 * this bounds what one of them will do for one address, not the fleet. The
 * real ceiling on cost is the 12s timeout and the 3 MB read cap inside
 * `audit.ts` — no single request can run away.
 *
 * No D1 table backs this, and that is a product decision as much as a
 * technical one: the page promises "no database, no account, the report
 * disappears on refresh". Writing a row per check would make that sentence
 * false, so the abuse control lives in memory instead.
 */

import type { H3Event } from 'h3'
import { AUDIT_ERRORS, AuditError } from '../utils/audit'
import { auditForRequest } from '../utils/audit-self'
import { clientIp } from '../utils/http'

const WINDOW_MS = 60_000
const PER_WINDOW = 20

/** ip → timestamps inside the current window. */
const hits = new Map<string, number[]>()

function allow(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS)

  if (recent.length >= PER_WINDOW) {
    hits.set(ip, recent)
    return false
  }

  recent.push(now)
  hits.set(ip, recent)

  // Without this the map is a slow leak: one entry per address that ever
  // called, forever.
  if (hits.size > 2000) {
    for (const [key, stamps] of hits) {
      if (!stamps.length || now - stamps[stamps.length - 1]! > WINDOW_MS * 10) hits.delete(key)
    }
  }
  return true
}

function fail(event: H3Event, code: string, upstream?: number) {
  const copy = AUDIT_ERRORS[code] ?? AUDIT_ERRORS.internal_error!
  setResponseStatus(event, copy.status)
  setHeader(event, 'cache-control', 'no-store')
  return {
    ok: false,
    reason: code,
    ...(upstream ? { upstream_status: upstream } : {}),
    message_zh: copy.zh,
    message_en: copy.en,
  }
}

export default defineEventHandler(async (event) => {
  if (!allow(clientIp(event))) return fail(event, 'rate_limited')

  const body = await readBody(event).catch(() => null)
  const raw = String((body as Record<string, unknown> | null)?.url ?? '')
  const lang = String((body as Record<string, unknown> | null)?.lang ?? 'en')
    .toLowerCase()
    .startsWith('zh')
    ? 'zh'
    : 'en'

  try {
    const result = await auditForRequest(event, raw, lang)
    setHeader(event, 'cache-control', 'no-store')
    return result
  } catch (err) {
    if (err instanceof AuditError) return fail(event, err.code, err.upstream)
    // A bug in the scanner must not reach the client as a stack trace, and
    // must not be reported as "your page is unreachable" either.
    console.error('[audit]', err)
    return fail(event, 'internal_error')
  }
})
