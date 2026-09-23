import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './types'
import { AUTO_START_MS, addStopwatchLap, countdownElapsedMs, pauseTakeover, takeoverAfterCompletion } from './flow'

describe('redesign flow state', () => {
  it('creates an auto-start takeover for a completed focus session by default', () => {
    const state = takeoverAfterCompletion('focus', DEFAULT_SETTINGS, 2, 1_000)
    expect(state).toMatchObject({ kind: 'sessionOver', auto: true, sessionNumber: 2 })
    expect(countdownElapsedMs(state, 6_000)).toBe(AUTO_START_MS)
  })

  it('ends a block after a long break unless automatic restart is enabled', () => {
    expect(takeoverAfterCompletion('longBreak', DEFAULT_SETTINGS, 4, 10).kind).toBe('blockFinished')
    expect(takeoverAfterCompletion('longBreak', { ...DEFAULT_SETTINGS, autoStartAfterLongBreak: true }, 4, 10))
      .toMatchObject({ kind: 'breakOver', auto: true })
  })

  it('freezes an automatic countdown when paused', () => {
    const state = takeoverAfterCompletion('focus', DEFAULT_SETTINGS, 1, 1_000)
    const paused = pauseTakeover(state, 3_250)
    expect(countdownElapsedMs(paused, 20_000)).toBe(2_250)
  })

  it('stores newest laps first and derives each lap duration from its split', () => {
    const first = addStopwatchLap([], 10_000, 'one')
    const second = addStopwatchLap(first, 24_500, 'two')
    expect(second.map((lap) => lap.durationMs)).toEqual([14_500, 10_000])
  })
})
