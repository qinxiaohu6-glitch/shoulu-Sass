/**
 * POST /api/dr — Ahrefs Domain Rating, DR4, answered on our own origin.
 *
 * Ahrefs publishes a FREE Domain Rating endpoint that accepts `version=dr4`:
 *
 *   GET https://api.ahrefs.com/v3/public/domain-rating-free
 *       ?target=<domain>&version=dr4&output=json
 *   Authorization: Bearer <APIv3 key>
 *
 * "Free" means no paid plan and no API units — it does NOT mean keyless.
 * A keyless GET returns 403 ["Error","Forbidden"], and the docs say
 * "Requests to this endpoint are free, yet require an APIv3 key" and
 * "APIv3 keys are free to generate and use". So `NUXT_AHREFS_TOKEN` holds a
 * free key generated from a free Ahrefs account, not a billing credential.
 *
 * Everything about the lookup stays inside this site: the browser talks only
 * to /api/dr, the Worker makes the upstream call, and no failure state sends
 * the visitor to ahrefs.com (or anywhere else) to get the number. The single
 * outbound link on the page is the licence-required "Domain Rating by Ahrefs"
 * credit next to the value — an attribution, not a lookup step.
 *
 * Contract: every outcome is HTTP 200 with `ok`, because "we have no number"
 * is an answer the box renders, not an exception the page has to catch.
 *
 *   ok: true                → { value, version: 'dr4', ... }
 *   ok: false, reason: ...  → not_configured | invalid_domain | bad_key |
 *                             rate_limited | no_data | provider_error |
 *                             timeout | network_error | bad_response
 *
 * `body.compare === true` adds a DR3 → DR4 comparison to the same answer:
 * the free endpoint is called once with version=dr3 and once with dr4, and the
 * reply carries { dr3, dr4, delta }. It costs two rate-limit slots because it
 * is two upstream calls, and it is opt-in so a normal lookup stays one call.
 * Ahrefs' own UI still shows DR3 until 2026-12-01, which is why the two
 * numbers can legitimately disagree.
 *
 * No database and no account — the same promise the FAQ makes. The 24h result
 * memo and the per-IP limiter live in memory, scoped to one Worker isolate.
 * Besides saving calls on a free endpoint, this is what keeps the tool from
 * becoming a bulk DR scraper, which the Domain Rating License forbids.
 */

import type { H3Event } from 'h3'
import { clientIp } from '../utils/http'

const DEFAULT_ENDPOINT = 'https://api.ahrefs.com/v3/public/domain-rating-free'
type DrVersion = 'dr3' | 'dr4'
const DR_VERSION: DrVersion = 'dr4'
const DR3_VERSION: DrVersion = 'dr3'
const TIMEOUT_MS = 12_000

const WINDOW_MS = 10 * 60_000
const PER_WINDOW = 12
const RESULT_TTL_MS = 24 * 60 * 60_000
const RESULT_MAX = 500

/** ip → timestamps inside the current window (same shape as /api/audit). */
const hits = new Map<string, number[]>()
type MemoEntry = { value: number; license: string; at: number }
/** `${domain}|${version}` → last successful answer. Memory only, never persisted. */
const memo = new Map<string, MemoEntry>()
const memoKey = (domain: string, version: DrVersion) => `${domain}|${version}`

function cached(domain: string, version: DrVersion): MemoEntry | undefined {
  const hit = memo.get(memoKey(domain, version))
  return hit && Date.now() - hit.at < RESULT_TTL_MS ? hit : undefined
}

function remember(
  domain: string,
  version: DrVersion,
  got: { value: number; license: string },
  at: number,
) {
  memo.set(memoKey(domain, version), { ...got, at })
  if (memo.size > RESULT_MAX) {
    const oldest = memo.keys().next().value
    if (oldest) memo.delete(oldest)
  }
}

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

/** `https://WWW.Example.com:8080/path?x` → `example.com`; '' when invalid. */
function normalizeDomain(raw: string): string {
  let domain = (raw || '').trim().toLowerCase()
  for (const prefix of ['https://', 'http://']) {
    if (domain.startsWith(prefix)) domain = domain.slice(prefix.length)
  }
  domain = domain.split(/[/?#]/)[0] ?? ''
  domain = domain.split('@').pop() ?? ''
  domain = domain.split(':')[0] ?? ''
  domain = domain.replace(/^www\./, '').replace(/\.$/, '').trim()

  if (!domain || domain.length > 253) return ''
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return ''
  }
  // A dotted quad is not something Ahrefs has a DR for, and it is the classic
  // way to make an endpoint fetch an internal address.
  if (/^\d+(?:\.\d+){3}$/.test(domain)) return ''
  if ((domain.split('.').pop() ?? '').length < 2) return ''
  return domain
}

class DrError extends Error {
  constructor(
    public reason: string,
    public status = 0,
  ) {
    super(reason)
  }
}

/** One domain, one upstream call. Throws a coded DrError; never leaks the key. */
async function lookup(
  endpoint: string,
  domain: string,
  key: string,
  version: DrVersion = DR_VERSION,
): Promise<{ value: number; license: string }> {
  const url = new URL(endpoint)
  url.searchParams.set('target', domain)
  url.searchParams.set('version', version)
  url.searchParams.set('output', 'json')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url.toString(), {
      headers: {
        authorization: `Bearer ${key}`,
        accept: 'application/json',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
  } catch (err) {
    throw new DrError((err as Error)?.name === 'AbortError' ? 'timeout' : 'network_error')
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new DrError('bad_key', res.status)
    if (res.status === 429) throw new DrError('rate_limited', res.status)
    throw new DrError('provider_error', res.status)
  }

  let data: unknown
  try {
    // 200 KB is far more than one domain needs; the cap stops a wrong endpoint
    // from streaming a whole HTML error page into the parser.
    data = JSON.parse((await res.text()).slice(0, 200_000))
  } catch {
    throw new DrError('bad_response')
  }

  const node = (data as Record<string, unknown> | null)?.domain_rating
  if (!node || typeof node !== 'object') throw new DrError('no_data')

  const raw = (node as Record<string, unknown>).domain_rating
  if (raw === null || raw === undefined || raw === '') throw new DrError('no_data')
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new DrError('no_data')

  return {
    value: Math.round(value),
    license: String((node as Record<string, unknown>).license ?? ''),
  }
}

function answer(
  domain: string,
  got: { value: number; license: string },
  at: number,
  cached: boolean,
) {
  return {
    ok: true,
    domain,
    provider: 'ahrefs',
    metric: 'DR',
    version: DR_VERSION,
    value: got.value,
    checked_at: Math.floor(at / 1000),
    cached,
    ...(got.license ? { license: got.license } : {}),
  }
}

export default defineEventHandler(async (event: H3Event) => {
  setHeader(event, 'cache-control', 'no-store')

  const config = useRuntimeConfig(event)
  const key = String(config.ahrefsToken || '').trim()
  // Local test seam, like googleAuthUrl / mailEndpoint. Empty means real API.
  const endpoint = String(config.ahrefsDrEndpoint || '').trim() || DEFAULT_ENDPOINT

  const body = await readBody(event).catch(() => null)
  const payload = (body as Record<string, unknown> | null) ?? {}
  const domain = normalizeDomain(String(payload.domain ?? ''))
  if (!domain) return { ok: false, reason: 'invalid_domain', version: DR_VERSION }

  if (!key) return { ok: false, reason: 'not_configured', version: DR_VERSION }

  // Opt-in, and strictly `true`: a stray event object from a template handler
  // must never turn a one-call lookup into a two-call comparison.
  const compare = payload.compare === true
  if (!allow(clientIp(event))) {
    return { ok: false, reason: 'rate_limited', version: DR_VERSION }
  }
  if (compare && !allow(clientIp(event))) {
    return { ok: false, reason: 'rate_limited', version: DR_VERSION }
  }

  try {
    if (compare) {
      const seen4 = cached(domain, DR_VERSION)
      const seen3 = cached(domain, DR3_VERSION)
      const at = Date.now()
      let failedVersion: DrVersion = DR_VERSION

      try {
        const dr4 = seen4 ?? { ...(await lookup(endpoint, domain, key, DR_VERSION)), at }
        if (!seen4) remember(domain, DR_VERSION, dr4, at)

        failedVersion = DR3_VERSION
        const dr3 = seen3 ?? { ...(await lookup(endpoint, domain, key, DR3_VERSION)), at }
        if (!seen3) remember(domain, DR3_VERSION, dr3, at)

        return {
          ...answer(domain, dr4, dr4.at, Boolean(seen4)),
          compare: {
            dr3: { value: dr3.value, cached: Boolean(seen3) },
            dr4: { value: dr4.value, cached: Boolean(seen4) },
            delta: dr4.value - dr3.value,
          },
        }
      } catch (err) {
        const failure = err instanceof DrError ? err : new DrError('provider_error')
        return {
          ok: false,
          reason: failure.reason,
          version: DR_VERSION,
          // Which of the two upstream calls failed, so the page can say so
          // without exposing the endpoint, the key or the upstream body.
          failed_version: failedVersion,
          ...(failure.status ? { upstream_status: failure.status } : {}),
        }
      }
    }

    const seen = cached(domain, DR_VERSION)
    if (seen) return answer(domain, seen, seen.at, true)

    const got = await lookup(endpoint, domain, key)
    const at = Date.now()
    remember(domain, DR_VERSION, got, at)
    return answer(domain, got, at, false)
  } catch (err) {
    const failure = err instanceof DrError ? err : new DrError('provider_error')
    // The reason and the upstream status only. Never the key, the endpoint or
    // the raw upstream body — those belong in the server log, not the answer.
    return {
      ok: false,
      reason: failure.reason,
      version: DR_VERSION,
      ...(failure.status ? { upstream_status: failure.status } : {}),
    }
  }
})
