#!/usr/bin/env node
/**
 * Seed the directory tables from `shared/content/catalog.json`.
 *
 * The JSON stays the source of truth for *initial* content; this copies it into
 * SQLite so the admin panel has something to edit. Re-running is safe: every
 * statement is an upsert, and a row an operator has already edited is left
 * alone unless `--force` is passed.
 *
 *   node scripts/seed-directory.mjs              # local .data/local.sqlite
 *   node scripts/seed-directory.mjs --sql        # write a .sql file for D1
 *   node scripts/seed-directory.mjs --force      # overwrite existing rows
 *
 * The D1 path writes a file rather than connecting, because the production
 * database is only reachable through `wrangler d1 execute`, which the operator
 * runs deliberately:
 *
 *   npx wrangler d1 execute DB --remote --file=server/database/seed-directory.sql
 */

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const args = new Set(process.argv.slice(2))
const writeSql = args.has('--sql')
const force = args.has('--force')

const catalog = JSON.parse(readFileSync(join(root, 'shared/content/catalog.json'), 'utf8'))
const now = Math.floor(Date.now() / 1000)

const esc = (value) => String(value ?? '').replace(/'/g, "''")
const json = (value) => esc(JSON.stringify(value ?? []))

/* -------------------------------------------------------------------------
   rows
------------------------------------------------------------------------- */

const statements = []

function push(sql) {
  statements.push(sql.endsWith(';') ? sql : `${sql};`)
}

for (const tool of catalog.tools) {
  push(
    `INSERT INTO dir_tool (slug, url, logo, category, tags, status, is_featured, is_paid,
       featured_until, votes_total, votes_week, created_at, maker, shots, updated_at)
     VALUES ('${esc(tool.slug)}', '${esc(tool.url)}', '${esc(tool.logo)}', '${esc(tool.category)}',
       '${json(tool.tags)}', '${esc(tool.status)}', ${tool.is_featured ? 1 : 0}, ${tool.is_paid ? 1 : 0},
       '${esc(tool.featured_until)}', ${Number(tool.votes_total) || 0}, ${Number(tool.votes_week) || 0},
       '${esc(tool.created_at)}', '${esc(tool.maker)}', '${json(tool.shots)}', ${now})
     ON CONFLICT(slug) DO ${force ? 'UPDATE SET url = excluded.url, logo = excluded.logo, category = excluded.category, tags = excluded.tags, status = excluded.status, is_featured = excluded.is_featured, is_paid = excluded.is_paid, featured_until = excluded.featured_until, votes_total = excluded.votes_total, votes_week = excluded.votes_week, created_at = excluded.created_at, maker = excluded.maker, shots = excluded.shots, updated_at = excluded.updated_at' : 'NOTHING'};`,
  )

  for (const locale of ['en', 'zh']) {
    const name = tool[`name_${locale}`] ?? ''
    const short = tool[`short_${locale}`] ?? ''
    const longDesc = tool[`long_${locale}`] ?? ''
    const detail = tool[`detail_${locale}`] ?? null
    // A tool with no editorial block still gets a translation row so the admin
    // form has something to open. `{}` means "nothing written yet".
    const detailJson = detail ? JSON.stringify(detail) : '{}'

    push(
      `INSERT INTO dir_tool_tr (slug, locale, name, short, long_desc, detail, updated_at)
       VALUES ('${esc(tool.slug)}', '${locale}', '${esc(name)}', '${esc(short)}', '${esc(longDesc)}', '${esc(detailJson)}', ${now})
       ON CONFLICT(slug, locale) DO ${force ? 'UPDATE SET name = excluded.name, short = excluded.short, long_desc = excluded.long_desc, detail = excluded.detail, updated_at = excluded.updated_at' : 'NOTHING'};`,
    )
  }
}

for (const [index, category] of catalog.categories.entries()) {
  push(
    `INSERT INTO dir_category (slug, icon, sort, status, updated_at)
     VALUES ('${esc(category.slug)}', '${esc(category.icon)}', ${index}, 'published', ${now})
     ON CONFLICT(slug) DO ${force ? 'UPDATE SET icon = excluded.icon, sort = excluded.sort, updated_at = excluded.updated_at' : 'NOTHING'};`,
  )
  for (const locale of ['en', 'zh']) {
    push(
      `INSERT INTO dir_category_tr (slug, locale, name, description)
       VALUES ('${esc(category.slug)}', '${locale}', '${esc(category[`name_${locale}`] ?? '')}', '${esc(category[`desc_${locale}`] ?? '')}')
       ON CONFLICT(slug, locale) DO ${force ? 'UPDATE SET name = excluded.name, description = excluded.description' : 'NOTHING'};`,
    )
  }
}

for (const [index, tag] of catalog.tags.entries()) {
  push(
    `INSERT INTO dir_tag (slug, sort, updated_at)
     VALUES ('${esc(tag.slug)}', ${index}, ${now})
     ON CONFLICT(slug) DO ${force ? 'UPDATE SET sort = excluded.sort, updated_at = excluded.updated_at' : 'NOTHING'};`,
  )
  for (const locale of ['en', 'zh']) {
    push(
      `INSERT INTO dir_tag_tr (slug, locale, name)
       VALUES ('${esc(tag.slug)}', '${locale}', '${esc(tag[`name_${locale}`] ?? '')}')
       ON CONFLICT(slug, locale) DO ${force ? 'UPDATE SET name = excluded.name' : 'NOTHING'};`,
    )
  }
}

/* -------------------------------------------------------------------------
   write
------------------------------------------------------------------------- */

if (writeSql) {
  const out = join(root, 'server/database/seed-directory.sql')
  const header = `-- Generated by scripts/seed-directory.mjs from shared/content/catalog.json\n-- Apply with: npx wrangler d1 execute DB --remote --file=server/database/seed-directory.sql\n\n`
  writeFileSync(out, header + statements.join('\n') + '\n', 'utf8')
  console.log(`已写出 ${statements.length} 条语句 → ${out}`)
} else {
  const dir = join(root, '.data')
  mkdirSync(dir, { recursive: true })
  const db = new DatabaseSync(join(dir, 'local.sqlite'))
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(readFileSync(join(root, 'server/database/schema.sql'), 'utf8'))

  let done = 0
  db.exec('BEGIN')
  try {
    for (const sql of statements) {
      db.exec(sql)
      done += 1
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  const counts = {
    tools: db.prepare('SELECT COUNT(*) AS n FROM dir_tool').get().n,
    translations: db.prepare('SELECT COUNT(*) AS n FROM dir_tool_tr').get().n,
    categories: db.prepare('SELECT COUNT(*) AS n FROM dir_category').get().n,
    tags: db.prepare('SELECT COUNT(*) AS n FROM dir_tag').get().n,
  }

  console.log(`已执行 ${done} 条语句${force ? '（force：覆盖已有行）' : '（已存在的行保持不动）'}`)
  console.log(counts)
}
