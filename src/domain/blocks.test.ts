import { describe, expect, it } from 'vitest'
import { blockRecordFrom, dayKey, groupByDay, judgeBlock, withBreak, withSession } from './blocks'
import { startBlock } from './flow'
import { DEFAULT_SETTINGS, type BlockRecord, type SessionRecord } from './types'

const MIN = 60_000
const session = (id: string, blockId: string, focusedMin: number, completed: boolean): SessionRecord => ({
  id, mode: 'pomodoro', phase: 'focus', startedAt: 0, endedAt: focusedMin * MIN, focusedMs: focusedMin * MIN,
  completed, tagIds: [], segments: [], blockId,
})

describe('blocks', () => {
  it('keeps nothing for a block with no saved session', () => {
    const block = startBlock(DEFAULT_SETTINGS, 0, 'b')
    expect(blockRecordFrom(block, 10)).toBeNull()
    const kept = blockRecordFrom(withBreak(withSession(block, 's1'), { kind: 'short', startedAt: 1, endedAt: 2 }), 10)
    expect(kept).toMatchObject({ id: 'b', sessionIds: ['s1'], breaks: [{ kind: 'short' }], setup: { focusMin: 25, sessions: 4 } })
  })

  it('judges finished and early against each block\'s own setup', () => {
    const short: BlockRecord = { id: 'a', startedAt: 0, endedAt: 1, setup: { focusMin: 25, shortMin: 5, longMin: 15, sessions: 4 }, sessionIds: [], breaks: [] }
    const long: BlockRecord = { id: 'b', startedAt: 0, endedAt: 1, setup: { focusMin: 50, shortMin: 10, longMin: 20, sessions: 2 }, sessionIds: [], breaks: [] }
    const sessions = [
      session('1', 'a', 25, true), session('2', 'a', 25, true), session('3', 'a', 12, false),
      session('4', 'b', 50, true), session('5', 'b', 30, false),
    ]
    expect(judgeBlock(short, sessions)).toEqual({ finished: 2, early: 1, notStarted: 1, focusedMs: 62 * MIN })
    expect(judgeBlock(long, sessions)).toEqual({ finished: 1, early: 1, notStarted: 0, focusedMs: 80 * MIN })
  })

  it('files a block that runs past midnight under the day it started', () => {
    const start = new Date(2026, 8, 21, 23, 40).getTime()
    const end = new Date(2026, 8, 22, 1, 10).getTime()
    expect(dayKey(start)).toBe('2026-09-21')
    expect(dayKey(end)).toBe('2026-09-22')
    const setup = { focusMin: 25, shortMin: 5, longMin: 15, sessions: 4 }
    const late: BlockRecord = { id: 'late', startedAt: start, endedAt: end, setup, sessionIds: [], breaks: [] }
    const morning: BlockRecord = { id: 'morning', startedAt: new Date(2026, 8, 22, 9).getTime(), endedAt: new Date(2026, 8, 22, 11).getTime(), setup, sessionIds: [], breaks: [] }
    expect(groupByDay([late, morning]).map(g => [g.day, g.blocks.map(b => b.id)])).toEqual([
      ['2026-09-22', ['morning']],
      ['2026-09-21', ['late']],
    ])
  })
})
