import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, setupFromSettings } from './types'
import { blockAfterCompletion, startBlock } from './flow'
import { elapsedMs, finishTimer, isComplete, pauseTimer, resumeTimer, startTimer } from './timer'

const SETUP = setupFromSettings(DEFAULT_SETTINGS)

describe('timer rules', () => {
  it('preserves elapsed time across pause and resume', () => {
    const timer = startTimer('pomodoro', 'focus', [], SETUP, 1_000, 'one')
    const paused = pauseTimer(timer, 11_000)
    expect(paused.pausedAt).toBe(11_000)
    const resumed = resumeTimer(paused, 50_000)
    expect(resumed.pausedAt).toBeNull()
    expect(elapsedMs(resumed, 55_000)).toBe(15_000)
  })

  it('caps focus credit at the Pomodoro duration', () => {
    const timer = startTimer('pomodoro', 'focus', ['a'], SETUP, 0, 'one')
    expect(isComplete(timer, 2_000_000)).toBe(true)
    expect(finishTimer(timer, 2_000_000, true)?.focusedMs).toBe(1_500_000)
  })

  it('saves actual focused time when stopped early without completing the phase', () => {
    const timer = startTimer('pomodoro', 'focus', ['school'], SETUP, 1_000, 'early')
    const record = finishTimer(timer, 91_000, false)
    expect(record).toMatchObject({ id: 'early', focusedMs: 90_000, completed: false, tagIds: ['school'] })
    expect(finishTimer(timer, 59_000, false)).toBeNull()
  })

  it('reconciles a restored overdue timer from timestamps', () => {
    const original = startTimer('pomodoro', 'focus', [], SETUP, 1_000, 'restored')
    const restored = JSON.parse(JSON.stringify(original)) as typeof original
    expect(isComplete(restored, 1_501_000)).toBe(true)
    expect(finishTimer(restored, 1_501_000, true)?.id).toBe('restored')
  })

  it('offers a long break on the configured cadence', () => {
    let block = startBlock(DEFAULT_SETTINGS, 0, 'b')
    block = blockAfterCompletion(block, 'focus')
    block = blockAfterCompletion(block, 'focus')
    block = blockAfterCompletion(block, 'focus')
    expect(block.nextPhase).toBe('shortBreak')
    block = blockAfterCompletion(block, 'focus')
    expect(block.nextPhase).toBe('longBreak')
    expect(block.completedFocus).toBe(4)
    expect(blockAfterCompletion(block, 'longBreak').nextPhase).toBe('focus')
  })

  it('does not create records for breaks', () => {
    const timer = startTimer('pomodoro', 'shortBreak', [], SETUP, 0, 'break')
    expect(finishTimer(timer, 300_000, true)).toBeNull()
  })

  it('deduplicates tags when a timer starts', () => {
    const timer = startTimer('stopwatch', 'focus', ['a', 'a', 'b'], SETUP, 0, 'tags')
    expect(timer.tagIds).toEqual(['a', 'b'])
  })
})
