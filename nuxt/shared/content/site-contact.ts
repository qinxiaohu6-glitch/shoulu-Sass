/**
 * Operator identity — the single place Waffo's site review, the footer and
 * both legal documents read from.
 *
 * CONTACT_EMAIL is the owner's real, monitored inbox. LEGAL_NAME is still a
 * brand-level placeholder: a made-up company name would be a false statement
 * inside a legal document, so it stays as-is until the registered entity is
 * supplied. Changing a constant here updates every place that needs it —
 * no copy rewrite, no new page.
 */
export const CONTACT_EMAIL = 'qinxiaohu6@gmail.com'

/** Replace with the registered / trading entity, not just the brand. */
export const LEGAL_NAME = 'Product Atlas (Dirtool)'

/**
 * A second, monitored contact channel. Waffo's site check explicitly accepts
 * an official X / Telegram / Discord account in the footer, and its TOS
 * template says to list fewer *real* channels rather than six unmonitored ones.
 */
export const SOCIAL_X_HANDLE = '@qinxiaohu1029'
export const SOCIAL_X_URL = 'https://x.com/qinxiaohu1029'

/** A mailto: only when there is a real, monitored address. */
export function contactHref(): string {
  return CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : ''
}
