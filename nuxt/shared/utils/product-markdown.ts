import type { DetailItem } from '../types/catalog.ts'
import { CHECKED_BLOCK, FEATURES_EMPTY, PRICING_EMPTY, RELATED_HEADING } from './batch2.ts'

export interface MarkdownRelated {
  name: string
  slug: string
  short: string
}

/**
 * The public markdown copy of one product page. It repeats only fields the
 * HTML page is allowed to state.
 */
export function productMarkdown(input: {
  name: string
  short: string
  long: string
  url: string
  category: string
  maker: string
  features: DetailItem[]
  pricingLabel: string
  pricingUrl: string
  related: MarkdownRelated[]
}): string {
  const lines: string[] = [`# ${input.name}`, '']
  if (input.short) lines.push(input.short, '')
  if (input.long) lines.push(input.long, '')
  if (input.url) lines.push(`Website: ${input.url}`, '')
  if (input.category) lines.push(`Category: ${input.category}`)
  if (input.maker) lines.push(`Maker: ${input.maker}`)
  lines.push('')

  lines.push('## Features', '')
  if (input.features.length) {
    for (const item of input.features) {
      const title = item.title.trim()
      const desc = item.desc.trim()
      if (title && desc) lines.push(`- ${title}: ${desc}`)
      else if (title || desc) lines.push(`- ${title || desc}`)
    }
  } else {
    lines.push(FEATURES_EMPTY)
  }
  lines.push('')

  lines.push('## Pricing', '')
  if (input.pricingLabel || input.pricingUrl) {
    if (input.pricingLabel) lines.push(input.pricingLabel)
    if (input.pricingUrl) lines.push(input.pricingUrl)
  } else {
    lines.push(PRICING_EMPTY)
  }
  lines.push('')

  if (input.related.length) {
    lines.push(`## ${RELATED_HEADING}`, '')
    for (const item of input.related) {
      const short = item.short ? ` — ${item.short}` : ''
      lines.push(`- [${item.name}](https://dirtool.com/products/${item.slug})${short}`)
    }
    lines.push('')
  }

  lines.push('## What this page checked', '', CHECKED_BLOCK, '')
  return lines.join('\n')
}
