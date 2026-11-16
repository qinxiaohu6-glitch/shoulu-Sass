/**
 * For-sale listing fee and the approved public sentences.
 *
 * The charge is 990 cents USD, kind `for_sale_listing`. It is not a directory
 * tier and it is not in the campaign scope. Callers must not pass an amount.
 *
 * A dedicated Waffo product id is required before checkout will open. The
 * shared directory product id does not count. Until that id exists, public
 * empty states and CTAs say the fee is planned, not that it can be bought today.
 */

export const FOR_SALE_KIND = 'for_sale_listing' as const
export const FOR_SALE_AMOUNT_CENTS = 990

/** Server price. Takes no amount: the client cannot name this charge. */
export function forSaleAmountCents(): number {
  return FOR_SALE_AMOUNT_CENTS
}

/**
 * True only when the product map has its own `for_sale_listing` id.
 * A wildcard or the default directory product is not this SKU.
 */
export function forSaleProductConfigured(
  productIds: Record<string, string> | null | undefined,
): boolean {
  const id = productIds?.[FOR_SALE_KIND]
  return typeof id === 'string' && id.trim().length > 0
}

export const CHECKOUT_CLOSED_EN = 'Could not open the payment page — try again in a moment.'
export const CHECKOUT_CLOSED_ZH = '暂时打不开付款页面，请稍后再试。'

export const FOR_SALE_TITLE = 'Products for sale · Product Atlas'
export const FOR_SALE_META =
  'Listings offered by their makers. $9.90 to list, no commission, no escrow. Income is seller-reported. Buyers sign in to contact the seller.'
export const FOR_SALE_H1 = 'Products for sale'
export const FOR_SALE_SUBHEAD =
  'Makers list a product they are willing to sell. You see the asking price and the figures they chose to share. Product Atlas does not take a commission, hold funds, or guarantee a deal.'

export const SELLER_CTA = 'List a product for sale · $9.90'
export const ESTIMATE_CTA = 'Estimate a range'

/** L6. The listing helper. Do not shorten it. */
export const FOR_SALE_HELPER =
  'One payment of $9.90 per product, whatever the asking price. The listing stays up until you unlist it. The fee is not refundable. You can change the asking price after the listing is up, at no extra charge. If you unlist it and list it again, you pay another $9.90. The listing goes public after payment succeeds and it passes review. This page has no free for-sale tier.'

export const LABEL_ASKING = 'Asking price'
export const LABEL_REVENUE = 'Seller-reported revenue'
export const LABEL_PROFIT = 'Seller-reported profit'
export const LABEL_TEAM = 'Team'
export const LABEL_STACK = 'Stack'
export const INCOME_NOTE = 'Seller-reported. Product Atlas has not verified this.'
export const CONTACT_CTA = 'Contact seller'
export const CONTACT_NOTE =
  'Sign in to send a message. We email the seller. You settle payment and handover yourselves. We do not run escrow and we do not take a cut of the deal.'

/** 7.4 empty state. Use only when the dedicated product id is configured. */
export const FOR_SALE_EMPTY_READY =
  'No products are listed for sale yet. If you have a live listing, you can offer it for sale for a one-time $9.90 fee.'

/** Shown while the production product id is absent. Does not say the SKU is buyable today. */
export const FOR_SALE_EMPTY_PLANNED =
  'No products are listed for sale yet. A one-time $9.90 listing fee is planned. It will be payable once the listing product is configured.'

export const FOR_SALE_PLANNED_FEE =
  'A one-time fee of $9.90 will be payable once the listing product is configured.'

export const FOR_SALE_FACTS = [
  'No commission.',
  'Product Atlas does not hold the money. Buyer and seller arrange payment and handover themselves.',
  'For a larger deal, buyer and seller may use a third-party escrow on their own.',
  'Product Atlas does not guarantee a sale.',
] as const

export function forSaleEmptyState(skuReady: boolean): string {
  return skuReady ? FOR_SALE_EMPTY_READY : FOR_SALE_EMPTY_PLANNED
}

export function interestedLabel(count: number): string {
  if (!Number.isInteger(count) || count < 1) return ''
  return `${count} interested`
}

/** S13 fact block. The apostrophe in "seller's" is the approved character. */
export const FLIPPA_TITLE = 'Flippa alternatives: where to list a small product · Product Atlas'
export const FLIPPA_META =
  'Ways to list a small product for sale, including Product Atlas: $9.90 to list, no commission, no escrow. We disclose our own fee and our calculator assumptions.'
export const FLIPPA_H1 = 'Where to list a small product for sale'
export const FLIPPA_LEAD =
  'If you are selling a small product, the fee, the buyer contact path, and whether anyone holds the money matter more than the brand name on the marketplace. Here is how Product Atlas compares, in our own words.'

export const FLIPPA_FACTS = [
  '$9.90 once per product, until you unlist it.',
  'No commission.',
  'This page has no escrow. Buyer and seller settle payment and handover themselves.',
  'Income figures are seller-reported.',
  'Contact happens after the buyer signs in; we do not publish the seller’s email.',
] as const

export const FLIPPA_OFFICIAL_URL = 'https://flippa.com/'
export const FLIPPA_ACCESS_NOTE = 'Official site, accessed 2026-11-16.'
