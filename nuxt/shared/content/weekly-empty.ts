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
    zh: '这张榜按登录用户的投票排名，每周一重置。付费收录不改变这张榜。空着表示这一周还没有票，不是榜已经满了。',
    en: 'This board ranks listings by votes from signed-in people and resets every Monday. A paid listing does not change it. An empty week means there are no votes yet, not that the board is full.',
  },
  cta: {
    zh: '提交产品',
    en: 'Submit a product',
  },
} as const
