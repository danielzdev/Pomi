import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, setupFromSettings } from './types'
import { AUTO_START_MS, addStopwatchLap, blockAfterCompletion, blockMinutesLeft, startBlock, blockTotalMinutes, countdownElapsedMs, modeSwitchPrompt, pauseTakeover, takeoverAfterCompletion } from './flow'

describe('redesign flow state', () => {
  const afterFocus = (n: number) => {
    let block = startBlock(DEFAULT_SETTINGS, 0, 'b')
    for (let i = 0; i < n; i++) block = blockAfterCompletion(block, 'focus')
    return block
  }

  it('creates an auto-start takeover for a completed focus session by default', () => {
    const state = takeoverAfterCompletion('focus', afterFocus(2), DEFAULT_SETTINGS, 1_000)
    expect(state).toMatchObject({ kind: 'sessionOver', auto: true, sessionNumber: 2 })
    expect(countdownElapsedMs(state, 6_000)).toBe(AUTO_START_MS)
  })

  it('uses separate auto-start settings for short and long breaks', () => {
    const settings = { ...DEFAULT_SETTINGS, autoStartShortBreaks: false, autoStartLongBreak: true }
    expect(takeoverAfterCompletion('focus', afterFocus(3), settings, 0).auto).toBe(false)
    expect(takeoverAfterCompletion('focus', afterFocus(4), settings, 0).auto).toBe(true)
    expect(takeoverAfterCompletion('shortBreak', afterFocus(1), DEFAULT_SETTINGS, 0)).toMatchObject({ kind: 'breakOver', auto: false })
  })

  it('ends a block after a long break unless a new block starts automatically', () => {
    expect(takeoverAfterCompletion('longBreak', afterFocus(4), DEFAULT_SETTINGS, 10).kind).toBe('blockFinished')
    expect(takeoverAfterCompletion('longBreak', afterFocus(4), { ...DEFAULT_SETTINGS, autoStartNextBlock: true }, 10))
      .toMatchObject({ kind: 'breakOver', auto: true })
  })

  it('freezes an automatic countdown when paused', () => {
    const state = takeoverAfterCompletion('focus', afterFocus(1), DEFAULT_SETTINGS, 1_000)
    const paused = pauseTakeover(state, 3_250)
    expect(countdownElapsedMs(paused, 20_000)).toBe(2_250)
  })

  it('stores newest laps first and derives each lap duration from its split', () => {
    const first = addStopwatchLap([], 10_000, 'one')
    const second = addStopwatchLap(first, 24_500, 'two')
    expect(second.map((lap) => lap.durationMs)).toEqual([14_500, 10_000])
  })
})

describe('block time', () => {
  it('totals sessions, the short breaks between them, and the long break', () => {
    expect(blockTotalMinutes(setupFromSettings(DEFAULT_SETTINGS))).toBe(4 * 25 + 3 * 5 + 15)
  })

  it('counts what is left from the running phase to the end of the long break', () => {
    // Session 02 with 10 min to go: 10 + 2 sessions + 2 short breaks + long break.
    expect(blockMinutesLeft(setupFromSettings(DEFAULT_SETTINGS), 'focus', 1, 600_000)).toBe(10 + 50 + 10 + 15)
    // Short break after session 02 with 3 min to go: 3 + 2 sessions + 1 short + long.
    expect(blockMinutesLeft(setupFromSettings(DEFAULT_SETTINGS), 'shortBreak', 2, 180_000)).toBe(3 + 50 + 5 + 15)
    expect(blockMinutesLeft(setupFromSettings(DEFAULT_SETTINGS), 'longBreak', 4, 540_000)).toBe(9)
  })
})

describe('mode switch prompt', () => {
  it('says what a running session keeps', () => {
    expect(modeSwitchPrompt('pomodoro', { kind: 'focus', sessionNumber: 2, focusedMs: 438_000 })).toEqual({
      title: 'Switch to Stopwatch?', body: "This ends session 02. The 7 m 18 s you've focused is saved.",
    })
    expect(modeSwitchPrompt('pomodoro', { kind: 'focus', sessionNumber: 1, focusedMs: 30_000 }).body)
      .toBe('This ends session 01. Less than a minute, so nothing is saved.')
  })

  it('covers breaks and the stopwatch', () => {
    expect(modeSwitchPrompt('pomodoro', { kind: 'break' }).body).toBe('This ends the break and the block. Nothing more is saved.')
    expect(modeSwitchPrompt('stopwatch', { kind: 'stopwatch', elapsedMs: 252_000, laps: 6, display: '04:12' })).toEqual({
      title: 'Switch to Pomodoro?', body: 'This stops the stopwatch. 04:12 and 6 laps are saved.',
    })
  })
})
