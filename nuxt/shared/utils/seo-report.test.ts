import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import { buildSeoReport, seoPdfFilename, type SeoReportInput } from './seo-report.ts'
import { renderSeoPdf } from './seo-pdf.ts'

const here = dirname(fileURLToPath(import.meta.url))

function fixture(): SeoReportInput {
  const checks = Array.from({ length: 8 }, (_, i) => ({
    id: `c${i}`,
    group: i < 4 ? 'title' : 'content',
    label: i % 2 ? '标题长度' : 'Title length',
    status: (i === 0 ? 'fail' : i === 1 ? 'warn' : 'pass') as 'fail' | 'warn' | 'pass',
    detail: 'A public page was read. '.repeat(12),
    fix: i < 2 ? 'Shorten the title so it fits the result snippet.' : '',
  }))
  return {
    rubric: 2,
    final_url: 'https://example.com/pricing',
    score: 72,
    grade: 'C',
    title: 'Example',
    summary: { pass: 6, warn: 1, fail: 1 },
    groups: [
      { key: 'title', label_zh: '标题与描述', label_en: 'Title & description', score: 12, max: 20 },
      { key: 'content', label_zh: '内容', label_en: 'Content', score: 16, max: 20 },
    ],
    checks,
  }
}

function urisOf(doc: PDFDocument): string[][] {
  return doc.getPages().map((page) => {
    const annots = page.node.Annots()
    if (!annots) return []
    const urls: string[] = []
    for (let i = 0; i < annots.size(); i += 1) {
      const dict = annots.lookup(i)
      if (!(dict instanceof PDFDict)) continue
      const action = dict.lookup(PDFName.of('A'))
      if (!(action instanceof PDFDict)) continue
      const uri = action.get(PDFName.of('URI'))
      if (uri) urls.push(String(uri))
    }
    return urls
  })
}

test('the report names Product Atlas and only the three live dirtool.com paths', () => {
  const when = new Date('2026-11-10T02:00:00Z')
  const report = buildSeoReport(fixture(), 'en', when)
  assert.equal(report.filename, 'dirtool-seo-example.com-2026-11-10.pdf')
  assert.equal(seoPdfFilename('https://www.Example.com/a', when), report.filename)
  assert.match(report.footer, /Product Atlas/)
  assert.match(report.footer, /https:\/\/dirtool\.com/)
  assert.match(report.cover.brand, /https:\/\/dirtool\.com/)
  assert.deepEqual(
    report.next.map((item) => item.url.split('?')[0]),
    [
      'https://dirtool.com/seo-check',
      'https://dirtool.com/submit',
      'https://dirtool.com/pricing',
      'https://dirtool.com/tools',
      'https://dirtool.com/tools/dr-checker',
    ],
  )
  assert.match(report.next[1]?.url ?? '', /url=https%3A%2F%2Fexample\.com%2Fpricing/)
  const blob = JSON.stringify(report)
  assert.equal(blob.includes('/lab'), false)
  assert.equal(blob.includes('keyword-research'), false)
  assert.equal(blob.includes('Ahrefs'), false)
  assert.equal(blob.includes('50%'), false)
  assert.equal(report.fixes.length, 2)
  assert.match(report.fixes[0]?.tag ?? '', /Must fix/)
  assert.equal(report.areas.length, 2)

  const zh = buildSeoReport(fixture(), 'zh', when)
  assert.match(zh.cover.title, /诊断报告/)
  assert.match(zh.disclaimer.join(' '), /不是 Google 排名/)
})

test('a real PDF carries https://dirtool.com on the cover, section 6, and every page footer', async () => {
  const report = buildSeoReport(fixture(), 'zh', new Date('2026-11-10T02:00:00Z'))
  const bytes = await renderSeoPdf(report)
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString('latin1'), '%PDF-')
  const doc = await PDFDocument.load(bytes)
  assert.match(doc.getSubject() ?? '', /https:\/\/dirtool\.com/)
  assert.match(doc.getAuthor() ?? '', /Product Atlas/)
  assert.ok(doc.getPageCount() >= 2)
  const uris = urisOf(doc)
  assert.equal(uris.length, doc.getPageCount())
  for (const pageUris of uris) {
    assert.ok(pageUris.some((uri) => uri.includes('https://dirtool.com')), pageUris.join(','))
  }
  const flat = uris.flat().join('\n')
  assert.match(flat, /https:\/\/dirtool\.com\/seo-check/)
  assert.match(flat, /https:\/\/dirtool\.com\/submit/)
  assert.match(flat, /https:\/\/dirtool\.com\/pricing/)
  assert.match(flat, /https:\/\/dirtool\.com\/tools\/dr-checker/)
  assert.equal(flat.includes('/lab'), false)
  assert.equal(flat.includes('keyword-research'), false)
})

test('the pdf route re-runs the audit and does not invent a file when that fails', () => {
  const route = readFileSync(join(here, '../../server/api/audit/pdf.post.ts'), 'utf8')
  const deal = readFileSync(join(here, '../../app/components/BlackFridayDeal.vue'), 'utf8')
  const pricing = readFileSync(join(here, '../../app/pages/pricing.vue'), 'utf8')
  const page = readFileSync(join(here, '../../app/pages/seo-check.vue'), 'utf8')
  assert.ok(route.indexOf('await auditForRequest(') < route.indexOf('await renderSeoPdf'))
  assert.ok(route.indexOf('instanceof AuditError') > route.indexOf('await auditForRequest('))
  assert.equal(route.includes('INSERT'), false)
  assert.equal(route.includes('keyword-research'), false)
  assert.equal(route.includes('/lab'), false)
  assert.equal(route.includes('pagespeed'), false)
  assert.match(page, /\/api\/audit\/pdf/)
  assert.match(deal, /Launch pricing/)
  assert.match(deal, /LAUNCH PRICING/)
  assert.equal(deal.includes('~30% OFF'), false)
  assert.equal(deal.includes('30% off'), false)
  assert.match(deal, /Request invoice · See deals/)
  assert.match(deal, /effectiveQuote/)
  assert.match(deal, /id="black-friday"/)
  assert.equal(deal.includes('50% OFF'), false)
  assert.equal(deal.includes('Moonshot'), false)
  assert.equal(deal.includes('everything we sell'), false)
  assert.equal(deal.includes('/tools/'), false)
  assert.ok(pricing.indexOf('<BlackFridayDeal') < pricing.indexOf('STEP {{ step.n }}'))
  assert.equal(pricing.includes('id="black-friday"'), false)
})
