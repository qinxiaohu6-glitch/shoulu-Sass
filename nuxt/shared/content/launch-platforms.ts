/**
 * The launch platforms this site is compared against.
 *
 * One source for three places: the comparison table on `/alternatives`, the
 * card grid under it, and the eight `/alternatives/<slug>` pages. Editing a
 * row here changes all of them, so the hub and the spokes cannot drift.
 *
 * Editorial rules, because this page talks about other people's products:
 *   - Only describe a platform in terms anyone can check from its own site:
 *     launch rhythm, who it is aimed at, whether it is a community.
 *   - Never state another platform's price, traffic, or domain authority. Those
 *     change without notice and a stale number is a false claim.
 *   - **No outbound link to another platform.** Not on the table, not on a
 *     sub-page. A comparison page that hands the visitor to the thing it is
 *     comparing against is paying to advertise a competitor. The platform is
 *     named, which is all a reader needs to look it up.
 *   - `slug` is the URL segment and is part of the public address. Adding a row
 *     adds a page; renaming a slug breaks a link.
 */

export type LaunchPlatform = {
  /** URL segment under /alternatives/. */
  slug: string
  name: string
  rhythm: { en: string; zh: string }
  best: { en: string; zh: string }
  /**
   * One honest sentence on how it works, used as the lead of the sub-page.
   * No numbers, no promises, no comparison.
   */
  note: { en: string; zh: string }
}

export const LAUNCH_PLATFORMS: LaunchPlatform[] = [
  {
    slug: 'product-hunt',
    name: 'Product Hunt',
    rhythm: { en: 'Daily, 24-hour leaderboard', zh: '每天 · 24 小时榜' },
    best: {
      en: 'Big, well-prepared launches with an audience ready on day one',
      zh: '准备充分、首日就有受众的大型发布',
    },
    note: {
      en: 'A launch is a single day. Products are ranked by upvotes on that day, and the front page moves on the next morning.',
      zh: '发布只有一天。产品按当天的投票排名，第二天首页就换了一批。',
    },
  },
  {
    slug: 'betalist',
    name: 'BetaList',
    rhythm: { en: 'Curated listings of early-stage startups', zh: '精选早期创业项目' },
    best: {
      en: 'Pre-launch startups collecting beta signups',
      zh: '收集 beta 注册用户的发布前项目',
    },
    note: {
      en: 'A curated list rather than a race. The point is early signups before the product is public, not votes on launch day.',
      zh: '它是精选清单，不是竞赛。重点是产品公开前的早期注册，而不是发布当天的投票。',
    },
  },
  {
    slug: 'devhunt',
    name: 'DevHunt',
    rhythm: { en: 'Weekly launches', zh: '每周发布' },
    best: {
      en: 'Developer tools and open source projects',
      zh: '开发者工具与开源项目',
    },
    note: {
      en: 'Built around developer tools, so the audience reads changelogs and cares about how the thing is implemented.',
      zh: '围绕开发者工具，受众会看更新日志，也在意实现方式。',
    },
  },
  {
    slug: 'uneed',
    name: 'Uneed',
    rhythm: { en: 'Daily launches with a waiting line', zh: '每天发布，需排队' },
    best: {
      en: 'Makers who want a daily launch and a tools directory listing',
      zh: '想要每日发布并进入工具目录的开发者',
    },
    note: {
      en: 'A daily slot plus a browsable tool directory. Booking early matters because the queue decides the date.',
      zh: '每日一个位置，加一个可浏览的工具目录。要提前排期，因为队列决定日期。',
    },
  },
  {
    slug: 'peerlist',
    name: 'Peerlist Launchpad',
    rhythm: { en: 'Weekly launches for Peerlist members', zh: '面向 Peerlist 成员的每周发布' },
    best: {
      en: 'Builders who already use Peerlist as their profile',
      zh: '已经把 Peerlist 当作品集的开发者',
    },
    note: {
      en: 'The launch is attached to a professional profile, so the audience already knows who is shipping.',
      zh: '发布挂在职业档案上，受众本来就知道是谁在做。',
    },
  },
  {
    slug: 'fazier',
    name: 'Fazier',
    rhythm: { en: 'Daily launches', zh: '每天发布' },
    best: {
      en: 'Indie makers looking for another daily launch spot',
      zh: '想再找一个每日发布渠道的独立开发者',
    },
    note: {
      en: 'One more daily board. It is usually a second or third stop rather than the only one.',
      zh: '又一个每日榜。通常是第二、第三站，而不是唯一一站。',
    },
  },
  {
    slug: 'microlaunch',
    name: 'Microlaunch',
    rhythm: { en: 'Longer launch periods', zh: '更长的发布周期' },
    best: {
      en: 'Makers who want feedback over a longer window',
      zh: '想要更长时间收集反馈的开发者',
    },
    note: {
      en: 'A longer window than a single day, which suits products that need explaining before anyone can judge them.',
      zh: '比单日更长的时间窗，适合需要先解释才能被判断的产品。',
    },
  },
  {
    slug: 'hacker-news',
    name: 'Show HN (Hacker News)',
    rhythm: { en: 'Continuous, posts rise and fall within hours', zh: '持续发帖，几小时内升降' },
    best: {
      en: 'Technical products that can survive a sharp, honest crowd',
      zh: '经得起直接、尖锐讨论的技术产品',
    },
    note: {
      en: 'Not a directory and not a launch slot: a post that competes with every other post. The comments are the product.',
      zh: '既不是目录也不是发布位：一条与其他所有帖子竞争的内容。真正的产出是评论区。',
    },
  },
]

export function launchPlatform(slug: string): LaunchPlatform | undefined {
  return LAUNCH_PLATFORMS.find((platform) => platform.slug === slug)
}
