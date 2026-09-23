import { describe, expect, it } from 'vitest'
import { aggregate, buildDays, cellState, currentStreak, firstDay, periodRange, streakRuns, tagShares } from './stats'
import type { BlockRecord, SessionRecord, Tag } from './types'

const MIN = 60_000
const TODAY = new Date(2026, 8, 20, 15) // Sunday
const at = (dayOffset: number, hour = 10) => new Date(2026, 8, 20 + dayOffset, hour).getTime()
let n = 0
const session = (dayOffset: number, minutes: number, extra: Partial<SessionRecord> = {}): SessionRecord => {
  const start = at(dayOffset)
  return {
    id: `s${n++}`, mode: 'pomodoro', phase: 'focus', startedAt: start, endedAt: start + minutes * MIN, focusedMs: minutes * MIN,
    completed: true, tagIds: [], segments: [{ startedAt: start, endedAt: start + minutes * MIN, tagIds: [], focusedMs: minutes * MIN }], blockId: null, ...extra,
  }
}

describe('statistics', () => {
  it('starts weeks on Monday', () => {
    const week = periodRange('W', 0, TODAY)
    expect(week.start).toEqual(new Date(2026, 8, 14))
    expect(week.end).toEqual(new Date(2026, 8, 20))
    expect(periodRange('M', -1, TODAY)).toEqual({ start: new Date(2026, 7, 1), end: new Date(2026, 7, 31) })
  })

  it('never counts days before first use, and keeps today hollow until it counts', () => {
    const days = buildDays([session(-2, 150), session(0, 60)], [])
    const first = firstDay(days, TODAY)
    const week = aggregate(periodRange('W', 0, TODAY), days, TODAY, first, 120)
    expect(week.elapsed).toBe(3)
    expect(week.counted).toBe(1)
    expect(cellState(new Date(2026, 8, 17), days, TODAY, first, 120)).toBe('before')
    expect(cellState(new Date(2026, 8, 18), days, TODAY, first, 120)).toBe('counted')
    expect(cellState(new Date(2026, 8, 19), days, TODAY, first, 120)).toBe('missed')
    expect(cellState(new Date(2026, 8, 20), days, TODAY, first, 120)).toBe('today')
    expect(cellState(new Date(2026, 8, 21), days, TODAY, first, 120)).toBe('future')
  })

  it('recomputes every streak when the threshold changes', () => {
    const records = [session(-4, 100), session(-3, 130), session(-2, 150), session(-1, 125), session(0, 90)]
    const days = buildDays(records, [])
    const first = firstDay(days, TODAY)
    expect(currentStreak(days, TODAY, 120)).toBe(3) // today not counted yet doesn't break it
    expect(currentStreak(days, TODAY, 90)).toBe(5)
    expect(currentStreak(days, TODAY, 140)).toBe(0)
    expect(streakRuns(days, first, TODAY, 120).map(r => r.length)).toEqual([3])
    expect(streakRuns(days, first, TODAY, 140).map(r => r.length)).toEqual([1])
  })

  it('judges finished vs early per block against the setup it started with', () => {
    const b25: BlockRecord = { id: 'a', startedAt: at(0, 9), endedAt: at(0, 11), setup: { focusMin: 25, shortMin: 5, longMin: 15, sessions: 2 }, sessionIds: [], breaks: [] }
    const b50: BlockRecord = { id: 'b', startedAt: at(0, 13), endedAt: at(0, 15), setup: { focusMin: 50, shortMin: 10, longMin: 20, sessions: 2 }, sessionIds: [], breaks: [] }
    const records = [
      session(0, 25, { blockId: 'a' }), session(0, 25, { blockId: 'a' }),
      session(0, 50, { blockId: 'b' }), session(0, 30, { blockId: 'b', completed: false }),
    ]
    const a = aggregate(periodRange('D', 0, TODAY), buildDays(records, [b25, b50]), TODAY, new Date(2026, 8, 20), 120)
    expect(a).toMatchObject({ sessions: 4, finished: 3, earlyCount: 1, blocks: 2, blocksFinished: 1, earlyShortMs: 20 * MIN })
  })

  it('credits overlapping tags per stretch and keeps untagged time', () => {
    const tags: Tag[] = [{ id: 'x', name: 'X', color: '#B96A1A', createdAt: 0 }, { id: 'y', name: 'Y', color: '#58806F', createdAt: 0, deletedAt: 5 }]
    const s = session(0, 30, { segments: [
      { startedAt: 0, endedAt: 0, tagIds: ['x'], focusedMs: 10 * MIN },
      { startedAt: 0, endedAt: 0, tagIds: ['x', 'y'], focusedMs: 10 * MIN },
      { startedAt: 0, endedAt: 0, tagIds: ['y'], focusedMs: 10 * MIN },
    ] })
    const { rows, untagged } = tagShares([s], tags, periodRange('D', 0, TODAY))
    expect(rows.map(r => [r.tag?.id, r.focusMs / MIN])).toEqual([['x', 20]])
    expect(untagged.focusMs).toBe(10 * MIN)
  })
})
