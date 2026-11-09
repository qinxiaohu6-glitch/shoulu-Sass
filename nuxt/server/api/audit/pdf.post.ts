/**
 * POST /api/audit/pdf — the same public-page check as /api/audit, returned
 * as a PDF file.
 *
 * The score is computed here. A failed fetch answers with the audit error and
 * does not attach a report. Nothing is written to D1. Domain Rating is not
 * included.
 */

import type { H3Event } from 'h3'
import { AUDIT_ERRORS, AuditError, audit } from '../../utils/audit'
import { clientIp } from '../../utils/http'
import { buildSeoReport, type SeoReportLang } from '~~/shared/utils/seo-report'
import { renderSeoPdf } from '~~/shared/utils/seo-pdf'

const WINDOW_MS = 60_000
const PER_WINDOW = 10
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
  return true
}

function fail(event: H3Event, code: string, upstream?: number) {
  const copy = AUDIT_ERRORS[code] ?? AUDIT_ERRORS.internal_error!
  setResponseStatus(event, copy.status)
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
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
  const lang: SeoReportLang = String((body as Record<string, unknown> | null)?.lang ?? 'en')
    .toLowerCase()
    .startsWith('zh')
    ? 'zh'
    : 'en'

  try {
    const result = await audit(raw, lang)
    const report = buildSeoReport(result, lang)
    const bytes = await renderSeoPdf(report)
    setHeader(event, 'content-type', 'application/pdf')
    setHeader(event, 'content-disposition', `attachment; filename="${report.filename}"`)
    setHeader(event, 'cache-control', 'no-store')
    return Buffer.from(bytes)
  } catch (err) {
    if (err instanceof AuditError) return fail(event, err.code, err.upstream)
    console.error('[audit-pdf]', err)
    return fail(event, 'internal_error')
  }
})
