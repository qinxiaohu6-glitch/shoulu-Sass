/**
 * The Monday job.
 *
 * Cloudflare runs a Worker on a Cron Trigger and Nitro re-emits it as the
 * `cloudflare:scheduled` runtime hook. The handler freezes the week that just
 * closed into `week_archive` so its tally outlives the `votes` rows it came
 * from — see `server/utils/archive.ts` for why that matters.
 *
 * The hook never fires under `nuxt dev`, so this plugin is inert locally; the
 * same function is reachable by hand through `POST /api/admin/archive`, which
 * is how it gets tested.
 *
 * Nothing here throws: a cron failure that rejects would show up as a Worker
 * error with no context. It logs and returns, and the next tick retries —
 * `archiveWeek` is idempotent, so a retry cannot double-count.
 */

import { previousWeekId, archiveWeek } from '../utils/archive'
import { useDb } from '../utils/db'

type ScheduledPayload = { env?: unknown }

export default defineNitroPlugin((nitro) => {
  // The `cloudflare:scheduled` hook is declared by Nitro's Cloudflare preset,
  // which is only in scope when building for that target. Casting the hook
  // registry keeps this file typechecking under the default preset too.
  const hooks = nitro.hooks as unknown as {
    hook(name: string, handler: (payload: ScheduledPayload) => unknown): void
  }

  hooks.hook('cloudflare:scheduled', async ({ env }) => {
    try {
      const db = await useDb({ context: { cloudflare: { env } } })
      const week = previousWeekId()
      const result = await archiveWeek(db, week)
      console.log(`[cron] archived ${result.week}: ${result.rows} listings`)
    } catch (err) {
      console.error('[cron] archive failed', err)
    }
  })
})
