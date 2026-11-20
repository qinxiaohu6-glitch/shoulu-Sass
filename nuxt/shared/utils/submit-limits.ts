/**
 * How short a listing field may be before the queue refuses it.
 *
 * The floors are a *free-queue* gate. A free listing costs a review slot and
 * nothing else, so a two-word tagline is not worth one. A paid order is the
 * opposite case: the buyer has already decided to pay, and a length check that
 * fires between the card form and the checkout page is the one gate that costs
 * money instead of saving it. Paid plans therefore only have to be non-empty —
 * the text can be edited after it is online.
 *
 * The maximums are not gates at all: `cleanText` trims to the cap rather than
 * rejecting, so a long description is shortened, never bounced.
 */

export const NAME_MIN = 2
export const NAME_MAX = 60
export const SHORT_MIN = 20
export const SHORT_MAX = 200
export const LONG_MIN = 120
export const LONG_MAX = 4000

/** The only length a paid submission has to clear: something was typed. */
export const PAID_MIN = 1

/**
 * The minimum length that actually applies.
 *
 * `paid` is passed explicitly rather than inferred from a plan string, so an
 * unknown or misspelled tier keeps the strict floor instead of silently
 * unlocking the relaxed one. The caller decides with `isPaidPlan()`, which owns
 * the list of paid tiers.
 *
 * `Math.min` keeps an optional field's floor at 0 instead of raising it to 1.
 */
export function textFloor(paid: boolean, freeFloor: number): number {
  return paid ? Math.min(PAID_MIN, freeFloor) : freeFloor
}
