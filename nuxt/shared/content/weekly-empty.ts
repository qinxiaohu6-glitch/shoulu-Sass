/**
 * Guest-facing copy for an empty weekly board.
 *
 * Product will replace these strings. Keep every sentence here so the weekly
 * page does not grow a second set. The current week and any archived week
 * with no rows share this object.
 */
export const WEEKLY_EMPTY_COPY = {
  title: {
    zh: '本周还没有上榜产品',
    en: 'No products on the board this week',
  },
  body: {
    zh: '提交产品后，它才有机会出现在这张榜上。',
    en: 'Submit a product to give it a chance to show up here.',
  },
  cta: {
    zh: '提交产品',
    en: 'Submit a product',
  },
} as const
