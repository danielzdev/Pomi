import { describe, expect, it } from 'vitest'
import { closedSegments, cutTags, dropTag, finishTimer, pauseTimer, resumeTimer, startTimer } from './timer'
import { DEFAULT_SETTINGS, setupFromSettings } from './types'

const SETUP = setupFromSettings(DEFAULT_SETTINGS)
const MIN = 60_000

describe('segment cuts', () => {
  it('closes the running stretch and opens a new one when a tag turns on or off', () => {
    let timer = startTimer('pomodoro', 'focus', ['a'], SETUP, 0, 's')
    timer = cutTags(timer, ['a', 'b'], 5 * MIN)
    timer = cutTags(timer, ['b'], 12 * MIN)
    const record = finishTimer(timer, 20 * MIN, false)!
    expect(record.segments).toEqual([
      { startedAt: 0, endedAt: 5 * MIN, tagIds: ['a'], focusedMs: 5 * MIN },
      { startedAt: 5 * MIN, endedAt: 12 * MIN, tagIds: ['a', 'b'], focusedMs: 7 * MIN },
      { startedAt: 12 * MIN, endedAt: 20 * MIN, tagIds: ['b'], focusedMs: 8 * MIN },
    ])
    expect(record.tagIds).toEqual(['a', 'b'])
    expect(record.focusedMs).toBe(20 * MIN)
  })

  it('drops a stretch with no focused time in it', () => {
    let timer = startTimer('pomodoro', 'focus', [], SETUP, 0, 's')
    timer = cutTags(timer, ['a'], 0)
    timer = cutTags(timer, ['a', 'b'], 3 * MIN)
    timer = cutTags(timer, ['b'], 3 * MIN)
    expect(closedSegments(timer, 10 * MIN).map(s => s.tagIds)).toEqual([['a'], ['b']])
  })

  it('does not count paused time toward a stretch', () => {
    let timer = startTimer('pomodoro', 'focus', ['a'], SETUP, 0, 's')
    timer = pauseTimer(timer, 5 * MIN)
    timer = resumeTimer(timer, 30 * MIN)
    timer = cutTags(timer, ['b'], 35 * MIN)
    const [first, second] = closedSegments(timer, 40 * MIN)
    expect(first).toMatchObject({ startedAt: 0, endedAt: 35 * MIN, focusedMs: 10 * MIN })
    expect(second).toMatchObject({ focusedMs: 5 * MIN })
  })

  it('removes a deleted tag from past stretches and cuts if it was on', () => {
    let timer = startTimer('pomodoro', 'focus', ['a', 'b'], SETUP, 0, 's')
    timer = dropTag(timer, 'a', 4 * MIN)
    expect(timer.tagIds).toEqual(['b'])
    expect(closedSegments(timer, 6 * MIN).map(s => s.tagIds)).toEqual([['b'], ['b']])
  })

  it('ends a finished session when it ran out, not when the app noticed', () => {
    const timer = startTimer('pomodoro', 'focus', [], SETUP, 0, 's')
    const record = finishTimer(timer, 90 * MIN, true)!
    expect(record.endedAt).toBe(25 * MIN)
    expect(record.segments[0].endedAt).toBe(25 * MIN)
  })
})
