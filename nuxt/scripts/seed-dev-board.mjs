#!/usr/bin/env node
/**
 * Seed the local board so the homepage feed renders real rows.
 *
 * The feed lists the products created in the selected ISO week, and the local
 * database has none — the curated catalogue is dated weeks 42-44 and nothing
 * else exists. So `isPreview` (dev only, and only when the real feed is empty)
 * takes over and renders five sample rows built from `<span>`s.
 *
 * That fallback hid a live bug for two days: the real row rendered a literal
 * `<NuxtLink>` element instead of an anchor, so the whole board was
 * unclickable in production while the local preview looked fine, because the
 * preview never renders a link at all. With a few rows in the current week the
 * homepage takes the production path locally, anchors included.
 *
 *   node scripts/seed-dev-board.mjs            # add 5 listings + this week's votes
 *   node scripts/seed-dev-board.mjs --clean    # remove them again
 *
 * Everything is prefixed `dev-` and lives in `.data/local.sqlite` only; the
 * production D1 is never touched. Re-running replaces the same five rows.
 */

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isoWeekId } from '../shared/utils/iso-week.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const clean = new Set(process.argv.slice(2)).has('--clean')

/**
 * Five listings, not one: the board's value is the ladder, and the row
 * variants that matter are "paid" (gold edge, crown, badge) and "free". Votes
 * are uneven so the ordering is visible and the counts are not all zero.
 */
const SEED = [
  {
    slug: 'dev-orbit-notes',
    name: 'Orbit Notes',
    short: 'Meeting notes that turn into tasks, owners and dates on their own.',
    category: 'productivity',
    url: 'https://orbit-notes.example',
    maker: 'Ana Ruiz',
    plan: 'free',
    votes: 27,
  },
  {
    slug: 'dev-pixel-forge',
    name: 'Pixel Forge',
    short: 'Batch background removal and resize for product photo catalogues.',
    category: 'image',
    url: 'https://pixel-forge.example',
    maker: 'Dmitri Sokolov',
    plan: 'featured',
    votes: 16,
  },
  {
    slug: 'dev-ship-radar',
    name: 'Ship Radar',
    short: 'A release feed for engineering teams: what shipped, when, by whom.',
    category: 'coding',
    url: 'https://ship-radar.example',
    maker: 'Priya Raman',
    plan: 'free',
    votes: 9,
  },
  {
    slug: 'dev-clipwise',
    name: 'Clipwise',
    short: 'Cuts long recordings into vertical clips with burned-in captions.',
    category: 'video',
    url: 'https://clipwise.example',
    maker: 'Tomás Oliveira',
    plan: 'free',
    votes: 6,
  },
  {
    slug: 'dev-kernel-log',
    name: 'Kernel Log',
    short: 'A plain-text journal for debugging sessions, searchable by symbol.',
    category: 'research',
    url: 'https://kernel-log.example',
    maker: 'Wei Chen',
    plan: 'free',
    votes: 3,
  },
]

const dir = join(root, '.data')
mkdirSync(dir, { recursive: true })
const db = new DatabaseSync(join(dir, 'local.sqlite'))
db.exec('PRAGMA journal_mode = WAL')
db.exec(readFileSync(join(root, 'server/database/schema.sql'), 'utf8'))

const week = isoWeekId()
const now = Math.floor(Date.now() / 1000)

function removeSeedRows() {
  db.prepare("DELETE FROM votes WHERE slug LIKE 'dev-%'").run()
  db.prepare("DELETE FROM submissions WHERE slug LIKE 'dev-%'").run()
}

removeSeedRows()

if (!clean) {
  const insertSubmission = db.prepare(`
    INSERT INTO submissions
      (id, slug, url, domain, name, short, long_desc, category, tags, email, logo, maker,
       plan, slot, status, paid_at, created_at, updated_at, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, '', ?, '[]', '', '', ?, ?, '', 'approved', ?, ?, ?, ?)
  `)
  const insertVote = db.prepare(
    'INSERT OR REPLACE INTO votes (week, slug, voter, created_at) VALUES (?, ?, ?, ?)',
  )

  db.exec('BEGIN')
  try {
    for (const [index, row] of SEED.entries()) {
      // A paid plan is public only after `paid_at` is set — the same gate the
      // real approval flow goes through, so the seed cannot show a listing the
      // site would never render.
      const paidAt = row.plan === 'free' ? null : now
      insertSubmission.run(
        `s_dev_${index + 1}`,
        row.slug,
        row.url,
        new URL(row.url).hostname,
        row.name,
        row.short,
        row.category,
        row.maker,
        row.plan,
        paidAt,
        now,
        now,
        now,
      )
      for (let vote = 0; vote < row.votes; vote += 1) {
        insertVote.run(week, row.slug, `dev:seed:${row.slug}:${vote}`, now)
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

const counts = {
  listings: db.prepare("SELECT COUNT(*) AS n FROM submissions WHERE slug LIKE 'dev-%'").get().n,
  votes: db.prepare("SELECT COUNT(*) AS n FROM votes WHERE slug LIKE 'dev-%'").get().n,
}

console.log(clean ? '已清除本地演示条目' : `已写入本周（${week}）的演示条目`)
console.log(counts)
if (!clean) {
  console.log('重启 dev 服务后，首页将渲染 5 行真实 feed（1 条付费），不再显示预览示例行。')
}
