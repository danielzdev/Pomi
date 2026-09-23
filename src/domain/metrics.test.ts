import { describe, expect, it } from 'vitest'
import { calculateFocusMetrics } from './metrics'
import type { Segment, SessionRecord, Tag } from './types'

const tags: Tag[] = [
  { id: 'school', name: 'School', color: '#B96A1A', createdAt: 1 },
  { id: 'reading', name: 'Reading', color: '#58806F', createdAt: 2 },
]

const MIN = 60_000
const seg = (focusedMs: number, tagIds: string[]): Segment => ({ startedAt: 0, endedAt: focusedMs, tagIds, focusedMs })
const session = (id: string, segments: Segment[]): SessionRecord => {
  const focusedMs = segments.reduce((sum, s) => sum + s.focusedMs, 0)
  return {
    id, mode: 'pomodoro', phase: 'focus', startedAt: 0, endedAt: focusedMs, focusedMs, completed: true,
    tagIds: [...new Set(segments.flatMap(s => s.tagIds))], segments, blockId: null,
  }
}

describe('focus metrics', () => {
  it('credits overlapping tags without double-counting the overall total', () => {
    const metrics = calculateFocusMetrics([
      session('one', [seg(30 * MIN, ['school', 'reading'])]),
      session('two', [seg(10 * MIN, ['school'])]),
    ], tags)

    expect(metrics.overallFocusedMs).toBe(40 * MIN)
    expect(metrics.byTag.find((tag) => tag.id === 'school')?.focusedMs).toBe(40 * MIN)
    expect(metrics.byTag.find((tag) => tag.id === 'reading')?.focusedMs).toBe(30 * MIN)
  })

  it('credits each tag only for the stretches it was on', () => {
    const metrics = calculateFocusMetrics([session('one', [seg(10 * MIN, ['school']), seg(15 * MIN, ['school', 'reading']), seg(5 * MIN, [])])], tags)
    expect(metrics.overallFocusedMs).toBe(30 * MIN)
    expect(metrics.byTag.find((tag) => tag.id === 'school')?.focusedMs).toBe(25 * MIN)
    expect(metrics.byTag.find((tag) => tag.id === 'reading')?.focusedMs).toBe(15 * MIN)
    expect(metrics.untaggedMs).toBe(5 * MIN)
  })

  it('does not credit a duplicated tag id twice', () => {
    const metrics = calculateFocusMetrics([session('one', [seg(MIN, ['school', 'school'])])], tags)
    expect(metrics.byTag.find((tag) => tag.id === 'school')?.focusedMs).toBe(MIN)
  })

  it('turns time from a deleted tag into Untagged without losing it from the total', () => {
    const records = [session('one', [seg(20 * MIN, ['reading']), seg(10 * MIN, ['reading', 'school'])])]
    const deleted = tags.map(t => t.id === 'reading' ? { ...t, deletedAt: 5 } : t)
    const metrics = calculateFocusMetrics(records, deleted)
    expect(metrics.overallFocusedMs).toBe(30 * MIN)
    expect(metrics.byTag.map(t => t.id)).toEqual(['school'])
    expect(metrics.untaggedMs).toBe(20 * MIN)
    // A purged tag (gone from the list entirely) reads the same.
    expect(calculateFocusMetrics(records, tags.filter(t => t.id !== 'reading')).untaggedMs).toBe(20 * MIN)
  })
})
