/**
 * Browser-only valuation range.
 *
 * Every number used here is also written in VALUATION_ASSUMPTIONS. Do not add
 * another multiple, and do not price a zero-profit business off revenue.
 */

export const ANNUAL_PROFIT_LOW = 2
export const ANNUAL_PROFIT_MID = 3
export const ANNUAL_PROFIT_HIGH = 4
export const MULTIPLE_STEP = 0.5
export const GROWTH_UP_PERCENT = 20
export const CHURN_DOWN_PERCENT = 5
export const CHURN_UP_PERCENT = 2
export const LOW_FLOOR_MULTIPLE = 1

export const VALUATION_TITLE = 'SaaS valuation calculator · Product Atlas'
export const VALUATION_META =
  'Get a low, mid, and high range from revenue, margin, growth, and churn. The math runs in your browser. The range is a starting point, not an offer.'
export const VALUATION_H1 = 'SaaS valuation calculator'
export const VALUATION_SUBHEAD =
  'Enter monthly or annual revenue, profit margin, growth, and churn. We apply disclosed multiples and show a low, mid, and high range. Nothing is uploaded to our servers.'
export const VALUATION_CTA = 'Calculate range'
export const VALUATION_RESULT =
  'This is an estimated range, not a bid and not a promise that a buyer will pay it. We disclose every multiple used below.'
export const VALUATION_NOT_UPLOADED = 'Nothing is uploaded to our servers.'
export const VALUATION_CARD_TITLE = 'SaaS valuation calculator'
export const VALUATION_CARD_BODY =
  'A low, mid, and high range from figures you enter. It runs in your browser.'
export const VALUATION_CARD_LINK = 'Open the calculator →'
export const VALUATION_FOOTER = 'Listing fee $9.90, no commission, no escrow.'

export const VALUATION_ASSUMPTIONS = [
  'These figures are Product Atlas assumptions, not an appraisal.',
  'The calculation runs in your browser and is not uploaded to our servers.',
  `We start from annual profit: low ${ANNUAL_PROFIT_LOW}×, mid ${ANNUAL_PROFIT_MID}×, and high ${ANNUAL_PROFIT_HIGH}×.`,
  `If annual growth is ${GROWTH_UP_PERCENT}% or more, mid and high each go up by ${MULTIPLE_STEP}×. If growth is negative, low and mid each go down by ${MULTIPLE_STEP}×.`,
  `If monthly churn is ${CHURN_DOWN_PERCENT}% or more, every tier goes down by ${MULTIPLE_STEP}×. If monthly churn is ${CHURN_UP_PERCENT}% or less, mid and high each go up by ${MULTIPLE_STEP}×.`,
  `Low is never below ${LOW_FLOOR_MULTIPLE}× annual profit.`,
  'If profit is zero or negative, we do not show a profit multiple, and we do not substitute a revenue multiple to invent a price-like number.',
] as const

export interface ValuationInput {
  period: 'month' | 'year'
  revenue: number
  marginPercent: number
  growthPercent: number
  churnPercent: number
}

export type ValuationOutput =
  | { showMultiple: false; reason: 'invalid' | 'non_positive_profit' }
  | {
      showMultiple: true
      annualProfit: number
      lowMultiple: number
      midMultiple: number
      highMultiple: number
      low: number
      mid: number
      high: number
    }

export function profitMultiples(growthPercent: number, churnPercent: number) {
  let low = ANNUAL_PROFIT_LOW
  let mid = ANNUAL_PROFIT_MID
  let high = ANNUAL_PROFIT_HIGH
  if (growthPercent >= GROWTH_UP_PERCENT) {
    mid += MULTIPLE_STEP
    high += MULTIPLE_STEP
  } else if (growthPercent < 0) {
    low -= MULTIPLE_STEP
    mid -= MULTIPLE_STEP
  }
  if (churnPercent >= CHURN_DOWN_PERCENT) {
    low -= MULTIPLE_STEP
    mid -= MULTIPLE_STEP
    high -= MULTIPLE_STEP
  } else if (churnPercent <= CHURN_UP_PERCENT) {
    mid += MULTIPLE_STEP
    high += MULTIPLE_STEP
  }
  if (low < LOW_FLOOR_MULTIPLE) low = LOW_FLOOR_MULTIPLE
  return { low, mid, high }
}

export function annualProfitOf(input: ValuationInput): number | null {
  if (input.period !== 'month' && input.period !== 'year') return null
  const numbers = [input.revenue, input.marginPercent, input.growthPercent, input.churnPercent]
  if (numbers.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null
  const annualRevenue = input.period === 'month' ? input.revenue * 12 : input.revenue
  return (annualRevenue * input.marginPercent) / 100
}

export function calculateValuation(input: ValuationInput): ValuationOutput {
  const profit = annualProfitOf(input)
  if (profit == null) return { showMultiple: false, reason: 'invalid' }
  if (profit <= 0) return { showMultiple: false, reason: 'non_positive_profit' }
  const multiples = profitMultiples(input.growthPercent, input.churnPercent)
  return {
    showMultiple: true,
    annualProfit: profit,
    lowMultiple: multiples.low,
    midMultiple: multiples.mid,
    highMultiple: multiples.high,
    low: profit * multiples.low,
    mid: profit * multiples.mid,
    high: profit * multiples.high,
  }
}
