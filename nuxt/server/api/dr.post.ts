/**
 * POST /api/dr — Domain Rating lookup, real numbers only.
 *
 * Three states, and the endpoint returns all three as 200 with `ok` telling
 * them apart, because they are answers, not failures:
 *
 *   provider configured + answered → { ok: true, value, provider, metric }
 *   provider configured + failed   → { ok: false, reason: 'provider_error' }
 *   nothing configured             → { ok: false, reason: 'not_configured' }
 *
 * The third one is the state this site is in today, and it is the reason the
 * endpoint exists at all: the page can then say "we have no data source" in
 * its own words instead of showing a spinner that never resolves.
 *
 * `metric` is part of the contract. Ahrefs answers DR on a 0–100 scale; Open
 * PageRank answers PR on 0–10. They are different measurements of different
 * things, and the UI labels whichever one came back. Presenting a PR as a DR
 * would be a lie a visitor can check in ten seconds.
 *
 * No cache. The Python build kept `data/dr-cache.json` with a 24h TTL to save
 * API credits; Workers have no filesystem and this build has no table for it.
 * Lookups are user-initiated, so the volume is small — but before a paid
 * provider is switched on, a D1 cache (domain, provider, value, checked_at)
 * should land first, or every click spends a row of API quota.
 */

type Provider = 'ahrefs' | 'openpagerank'

const TIMEOUT_MS = 12_000

/** `https://Example.com/path?x` → `example.com`; '' when it is not a domain. */
function normalizeDomain(raw: string): string {
  let domain = (raw || '').trim().toLowerCase()
  for (const prefix of ['https://', 'http://']) {
    if (domain.startsWith(prefix)) domain = domain.slice(prefix.length)
  }
  domain = domain.split('/')[0]!.split('?')[0]!.trim()
  if (!domain || !domain.includes('.')) return ''
  // Anything left that cannot be part of a hostname is a typo, not a domain.
  if (!/^[a-z0-9.-]+$/.test(domain)) return ''
  return domain
}

async function getJson(url: string, headers: Record<string, string>): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' })
    if (!res.ok) throw new Error(`http_${res.status}`)
    // 200 KB is far more than either provider returns for one domain; the cap
    // is there so a wrong endpoint cannot stream a whole HTML error page.
    const text = await res.text()
    return JSON.parse(text.slice(0, 200_000)) as Record<string, unknown>
  } finally {
    clearTimeout(timer)
  }
}

type Lookup = { provider: Provider; metric: 'DR' | 'PR'; value: number; rank?: unknown }

async function viaAhrefs(domain: string, token: string): Promise<Lookup | null> {
  const data = await getJson(
    'https://api.ahrefs.com/v3/site-explorer/domain-rating?target=' + encodeURIComponent(domain),
    { authorization: 'Bearer ' + token, accept: 'application/json' },
  )
  const node = (data.domain_rating ?? {}) as Record<string, unknown>
  const value = node.domain_rating
  if (value === null || value === undefined) return null
  return { provider: 'ahrefs', metric: 'DR', value: Math.round(Number(value)), rank: node.ahrefs_rank }
}

async function viaOpenPageRank(domain: string, key: string): Promise<Lookup | null> {
  const data = await getJson(
    'https://openpagerank.com/api/v1.0/getPageRank?domains%5B%5D=' + encodeURIComponent(domain),
    { 'API-OPR': key, accept: 'application/json' },
  )
  const rows = (data.response ?? []) as Record<string, unknown>[]
  if (!rows.length || Number(rows[0]!.status_code) !== 200) return null
  const row = rows[0]!
  return {
    provider: 'openpagerank',
    metric: 'PR',
    value: Math.round(Number(row.page_rank_decimal ?? 0) * 10) / 10,
    rank: row.rank,
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null)
  const domain = normalizeDomain(String((body as Record<string, unknown> | null)?.domain ?? ''))

  // Always 200: an unreadable domain is an answer the box can render, not an
  // exception the page has to catch.
  if (!domain) return { ok: false, reason: 'invalid_domain' }

  const config = useRuntimeConfig(event)
  const ahrefsToken = String(config.ahrefsToken || '').trim()
  const openPageRankKey = String(config.openPagerankKey || '').trim()

  if (!ahrefsToken && !openPageRankKey) {
    return { ok: false, reason: 'not_configured', providers: ['ahrefs', 'openpagerank'] }
  }

  let lastError = ''
  const attempts: { name: Provider; run: () => Promise<Lookup | null> }[] = []
  if (ahrefsToken) attempts.push({ name: 'ahrefs', run: () => viaAhrefs(domain, ahrefsToken) })
  if (openPageRankKey) {
    attempts.push({ name: 'openpagerank', run: () => viaOpenPageRank(domain, openPageRankKey) })
  }

  for (const attempt of attempts) {
    try {
      const got = await attempt.run()
      if (got) {
        setHeader(event, 'cache-control', 'public, max-age=3600')
        return {
          ok: true,
          domain,
          checked_at: Math.floor(Date.now() / 1000),
          cached: false,
          ...got,
        }
      }
    } catch (err) {
      // The provider name and the failure kind, never the key or the URL.
      lastError = `${attempt.name}: ${(err as Error)?.name || 'Error'}`
    }
  }

  return { ok: false, reason: 'provider_error', ...(lastError ? { detail: lastError } : {}) }
})
