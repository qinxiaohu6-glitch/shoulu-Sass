import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { medianReviewDays, queueStats } from './queue.ts'

const here = dirname(fileURLToPath(import.meta.url))

test('median review days is measured, and an empty sample stays null', () => {
  assert.equal(medianReviewDays([]), null)
  assert.equal(
    medianReviewDays([
      { createdAt: 0, reviewedAt: 2 * 86400 },
      { createdAt: 0, reviewedAt: 4 * 86400 },
      { createdAt: 0, reviewedAt: 9 * 86400 },
    ]),
    4,
  )
  const stats = queueStats({ freePending: 3, reviewedLast30d: 1, samples: [] })
  assert.equal(stats.free_pending, 3)
  assert.equal(stats.median_review_days, null)
  assert.equal(stats.paid_publish, 'immediate')
})

test('the queue route counts free pending rows and does not invent a date', () => {
  const source = readFileSync(join(here, '../../server/api/queue.get.ts'), 'utf8')
  assert.match(source, /plan = 'free'/)
  assert.match(source, /median_review_days/)
  assert.equal(source.includes('2026-01-13'), false)
  assert.equal(/free_pending:\s*\d+/.test(source), false)
})
