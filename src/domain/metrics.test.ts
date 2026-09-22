import { describe, expect, it } from 'vitest'
import { calculateFocusMetrics } from './metrics'
import type { SessionRecord, Tag } from './types'

const tags: Tag[] = [
  { id: 'school', name: 'School', createdAt: 1 },
  { id: 'reading', name: 'Reading', createdAt: 2 },
]

const session = (id: string, focusedMs: number, tagIds: string[]): SessionRecord => ({
  id,
  mode: 'pomodoro',
  phase: 'focus',
  startedAt: 0,
  endedAt: focusedMs,
  focusedMs,
  completed: true,
  tagIds,
})

describe('focus metrics', () => {
  it('credits overlapping tags without double-counting the overall total', () => {
    const metrics = calculateFocusMetrics([
      session('one', 30 * 60_000, ['school', 'reading']),
      session('two', 10 * 60_000, ['school']),
    ], tags)

    expect(metrics.overallFocusedMs).toBe(40 * 60_000)
    expect(metrics.byTag.find((tag) => tag.id === 'school')?.focusedMs).toBe(40 * 60_000)
    expect(metrics.byTag.find((tag) => tag.id === 'reading')?.focusedMs).toBe(30 * 60_000)
  })

  it('does not credit a duplicated tag id twice', () => {
    const metrics = calculateFocusMetrics([session('one', 60_000, ['school', 'school'])], tags)
    expect(metrics.byTag.find((tag) => tag.id === 'school')?.focusedMs).toBe(60_000)
  })
})

