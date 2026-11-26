import { AppStoreError, lookupAppStore } from '../../utils/app-store.ts'
import { clientIp } from '../../utils/http'

const WINDOW_MS = 10 * 60_000
const PER_WINDOW = 10
const lookupHits = new Map<string, number[]>()

function allowLookup(ip: string): boolean {
  const now = Date.now()
  const recent = (lookupHits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS)
  if (recent.length >= PER_WINDOW) {
    lookupHits.set(ip, recent)
    return false
  }
  recent.push(now)
  lookupHits.set(ip, recent)
  if (lookupHits.size > 2000) {
    for (const [key, stamps] of lookupHits) {
      if (!stamps.length || now - stamps[stamps.length - 1]! > WINDOW_MS * 10) lookupHits.delete(key)
    }
  }
  return true
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  if (!allowLookup(clientIp(event))) {
    setResponseStatus(event, 429)
    return { ok: false, code: 'rate_limited' }
  }
  const body = await readBody(event).catch(() => null) as Record<string, unknown> | null
  try {
    const info = await lookupAppStore(body?.url, body?.platform)
    setResponseHeader(event, 'cache-control', 'no-store')
    return { ok: true, app: info }
  } catch (error) {
    const err = error instanceof AppStoreError ? error : new AppStoreError('metadata_unavailable', 502)
    setResponseStatus(event, err.statusCode)
    return { ok: false, code: err.code }
  }
})
