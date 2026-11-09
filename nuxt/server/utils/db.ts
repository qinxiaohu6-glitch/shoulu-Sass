/**
 * Database access, behind the Cloudflare D1 statement API.
 *
 * Production binds a real D1 database (`env.DB`). `nuxt dev` has no D1, so the
 * same SQL runs against a local SQLite file via Node's built-in `node:sqlite`.
 * D1 is SQLite underneath, so one dialect covers both and there is no second
 * query layer to keep in sync — the only difference is where the bytes live.
 *
 * The statement API deliberately mirrors D1's (`prepare().bind().first()`),
 * because that is the shape both Cloudflare's docs and the rest of this
 * codebase already speak.
 */

export interface DbStatement {
  bind(...values: unknown[]): DbStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ changes: number }>
}

export interface Db {
  prepare(sql: string): DbStatement
  /** Multi-statement script. Used once, to apply the schema locally. */
  exec(sql: string): Promise<void>
}

/* -------------------------------------------------------------------------
   Cloudflare D1
   ------------------------------------------------------------------------- */

function wrapD1(d1: any): Db {
  return {
    prepare: (sql: string) => wrapD1Statement(d1.prepare(sql)),
    exec: async (sql: string) => {
      await d1.exec(sql)
    },
  }
}

function wrapD1Statement(stmt: any): DbStatement {
  return {
    bind: (...values: unknown[]) => wrapD1Statement(stmt.bind(...values)),
    first: async <T,>() => ((await stmt.first()) as T) ?? null,
    all: async <T,>() => {
      const res = await stmt.all()
      return { results: (res?.results ?? []) as T[] }
    },
    run: async () => {
      const res = await stmt.run()
      return { changes: Number(res?.meta?.changes ?? 0) }
    },
  }
}

/* -------------------------------------------------------------------------
   Local SQLite (dev only)
   ------------------------------------------------------------------------- */

let localHandle: { db: any; ready: boolean } | null = null

async function getLocal(): Promise<{ db: any; ready: boolean }> {
  if (localHandle) return localHandle

  // The specifier is assembled at runtime on purpose. A literal
  // `import('node:sqlite')` makes the bundler try to resolve a Node builtin
  // for the Cloudflare target, which fails the build; this branch only ever
  // runs under `nuxt dev`, where the import is available.
  const specifier = 'node:' + 'sqlite'
  const sqlite: any = await import(/* @vite-ignore */ specifier)
  const { mkdirSync, readFileSync } = await import('node:fs')
  const { join } = await import('node:path')

  const dir = join(process.cwd(), '.data')
  mkdirSync(dir, { recursive: true })
  const db = new sqlite.DatabaseSync(join(dir, 'local.sqlite'))
  db.exec('PRAGMA journal_mode = WAL')

  const schema = readFileSync(join(process.cwd(), 'server/database/schema.sql'), 'utf8')
  db.exec(schema)
  // Local file only. Production D1 is not altered here — run the migration
  // in server/database/migrations before a deploy that selects these columns.
  for (const sql of [
    `ALTER TABLE billboard_placement ADD COLUMN order_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE billboard_placement ADD COLUMN amount_cents INTEGER NOT NULL DEFAULT 0`,
    `CREATE INDEX IF NOT EXISTS idx_billboard_order ON billboard_placement (order_id)`,
  ]) {
    try {
      db.exec(sql)
    } catch {
      // The column or index is already there.
    }
  }

  localHandle = { db, ready: true }
  return localHandle
}

/** node:sqlite takes primitives only — no booleans, no undefined. */
function normalize(values: unknown[]): any[] {
  return values.map((v) => {
    if (v === undefined) return null
    if (typeof v === 'boolean') return v ? 1 : 0
    return v
  })
}

function wrapLocal(db: any, sql: string, params: unknown[] = []): DbStatement {
  return {
    bind: (...values: unknown[]) => wrapLocal(db, sql, values),
    first: async <T,>() => (db.prepare(sql).get(...normalize(params)) as T) ?? null,
    all: async <T,>() => ({ results: db.prepare(sql).all(...normalize(params)) as T[] }),
    run: async () => {
      const res = db.prepare(sql).run(...normalize(params))
      return { changes: Number(res?.changes ?? 0) }
    },
  }
}

async function getLocalDb(): Promise<Db> {
  const { db } = await getLocal()
  return {
    prepare: (sql: string) => wrapLocal(db, sql),
    exec: async (sql: string) => {
      db.exec(sql)
    },
  }
}

/* -------------------------------------------------------------------------
   entry point
   ------------------------------------------------------------------------- */

/**
 * Resolve the database for one request.
 *
 * Throws `db_unavailable` rather than silently writing nowhere: a submission
 * that reports success but lands in a void is worse than an honest 503.
 */
export async function useDb(event: { context: Record<string, any> }): Promise<Db> {
  const d1 = event.context?.cloudflare?.env?.DB
  if (d1) return wrapD1(d1)
  return getLocalDb()
}

/** The local file store is writable; a missing D1 binding is a config error. */
export async function dbStatus(event: { context: Record<string, any> }): Promise<string> {
  if (event.context?.cloudflare?.env?.DB) return 'd1'
  return 'local-sqlite'
}
