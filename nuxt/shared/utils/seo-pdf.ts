/**
 * Turn one SEO report into a real PDF.
 *
 * The brand URL is drawn on the cover, in section 6, and in the footer of
 * every page. Domain Rating is not a section. The file is not stored.
 */

import { PDFDocument, PDFFont, PDFPage, PDFString, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { BRAND_NAME, BRAND_URL, type SeoReport } from './seo-report.ts'
import { SEO_FONT_BASE64 } from './seo-font.ts'

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48
const FOOTER_Y = 28
const BODY = rgb(0.11, 0.09, 0.08)
const MUTED = rgb(0.34, 0.31, 0.28)
const RULE = rgb(0.86, 0.82, 0.76)

function fontBytes(): Uint8Array {
  const bin = Buffer.from(SEO_FONT_BASE64, 'base64')
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength)
}

class PdfWriter {
  page!: PDFPage
  y = 0
  readonly pages: PDFPage[] = []
  doc: PDFDocument
  font: PDFFont

  constructor(doc: PDFDocument, font: PDFFont) {
    this.doc = doc
    this.font = font
    this.addPage()
  }

  private addPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H])
    this.pages.push(this.page)
    this.y = PAGE_H - MARGIN
  }

  private safe(text: string): string {
    let out = ''
    for (const ch of text) {
      try {
        this.font.encodeText(ch)
        out += ch
      } catch {
        out += '?'
      }
    }
    return out
  }

  private wrap(text: string, size: number, maxWidth: number): string[] {
    const clean = this.safe(text).replace(/\r/g, '')
    const paragraphs = clean.split('\n')
    const lines: string[] = []
    for (const para of paragraphs) {
      let line = ''
      for (const ch of para) {
        const next = line + ch
        if (line && this.font.widthOfTextAtSize(next, size) > maxWidth) {
          lines.push(line)
          line = ch.trim() ? ch : ''
        } else {
          line = next
        }
      }
      lines.push(line || ' ')
    }
    return lines.length ? lines : [' ']
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN + 18) this.addPage()
  }

  text(value: string, size: number, color = BODY, gap = 4) {
    const max = PAGE_W - MARGIN * 2
    for (const line of this.wrap(value, size, max)) {
      this.ensure(size + gap)
      this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font: this.font, color })
      this.y -= size + gap
    }
  }

  /** A visible URL, plus a clickable link over that line. */
  linkLine(label: string, url: string, size = 11) {
    const max = PAGE_W - MARGIN * 2
    const line = this.wrap(`${label}  ${url}`, size, max)[0] ?? url
    this.ensure(size + 6)
    const y = this.y - size
    this.page.drawText(line, { x: MARGIN, y, size, font: this.font, color: rgb(0.45, 0.2, 0.05) })
    const width = Math.min(max, this.font.widthOfTextAtSize(line, size))
    const annot = this.doc.context.register(
      this.doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [MARGIN, y - 2, MARGIN + width, y + size + 2],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
      }),
    )
    this.page.node.addAnnot(annot)
    this.y -= size + 8
  }

  gap(n = 10) {
    this.y -= n
  }

  rule() {
    this.ensure(8)
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.6,
      color: RULE,
    })
    this.y -= 12
  }

  stampFooters(footer: string) {
    const label = this.safe(footer)
    for (const page of this.pages) {
      page.drawText(label, {
        x: MARGIN,
        y: FOOTER_Y,
        size: 9,
        font: this.font,
        color: MUTED,
      })
      const width = this.font.widthOfTextAtSize(label, 9)
      const annot = this.doc.context.register(
        this.doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [MARGIN, FOOTER_Y - 2, MARGIN + width, FOOTER_Y + 11],
          Border: [0, 0, 0],
          A: { Type: 'Action', S: 'URI', URI: PDFString.of(BRAND_URL) },
        }),
      )
      page.node.addAnnot(annot)
    }
  }
}

export async function renderSeoPdf(report: SeoReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(fontBytes(), { subset: true })
  doc.setTitle(report.cover.kicker)
  doc.setAuthor(BRAND_NAME)
  doc.setSubject(BRAND_URL)
  doc.setCreator(`${BRAND_NAME} ${BRAND_URL}`)
  doc.setProducer(`${BRAND_NAME} ${BRAND_URL}`)
  doc.setKeywords([BRAND_URL])

  const pen = new PdfWriter(doc, font)
  pen.text(report.cover.kicker, 11, MUTED, 6)
  pen.text(report.cover.title, 22, BODY, 8)
  pen.text(report.cover.scoreLine, 16, BODY, 6)
  pen.text(report.cover.checked, 11, BODY, 4)
  pen.text(report.cover.generated, 11, BODY, 4)
  pen.text(report.cover.rubric, 11, MUTED, 8)
  pen.linkLine(report.cover.brand, BRAND_URL, 12)
  pen.text(report.cover.pitch, 11, MUTED, 6)
  pen.rule()

  pen.text(report.summaryTitle, 14, BODY, 6)
  pen.text(report.verdict, 12, BODY, 4)
  pen.text(report.tally, 11, MUTED, 8)

  pen.text(report.fixesTitle, 14, BODY, 6)
  if (!report.fixes.length) {
    pen.text(report.lang === 'zh' ? '这几项里没有必须先改的。' : 'Nothing in the first pass needs a fix.', 11)
  } else {
    for (const fix of report.fixes) {
      pen.text(`${fix.tag} · ${fix.label}`, 12, BODY, 3)
      if (fix.detail) pen.text(fix.detail, 10, MUTED, 2)
      if (fix.how) pen.text(fix.how, 10, BODY, 6)
    }
  }
  pen.gap(4)

  pen.text(report.areasTitle, 14, BODY, 6)
  for (const area of report.areas) {
    pen.text(`${area.label}  ${area.score}/${area.max}`, 11, BODY, 3)
  }
  pen.gap(6)

  pen.text(report.checksTitle, 14, BODY, 6)
  let group = ''
  for (const check of report.checks) {
    if (check.group !== group) {
      group = check.group
      pen.gap(4)
      pen.text(group, 12, BODY, 4)
    }
    pen.text(`${check.status} · ${check.label}`, 11, BODY, 2)
    if (check.detail) pen.text(check.detail, 10, MUTED, 2)
    if (check.how) pen.text(check.how, 10, BODY, 5)
  }
  pen.gap(8)

  pen.text(report.disclaimerTitle, 14, BODY, 6)
  for (const line of report.disclaimer) pen.text(line, 11, BODY, 4)
  pen.gap(8)

  pen.text(report.nextTitle, 14, BODY, 6)
  for (const item of report.next) pen.linkLine(item.label, item.url, 11)

  pen.stampFooters(report.footer)
  return doc.save()
}
