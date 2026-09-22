import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './types'
import { elapsedMs, finishTimer, isComplete, pauseTimer, resumeTimer, settingsAfterCompletion, startTimer } from './timer'

describe('timer rules', () => {
  it('preserves elapsed time across pause and resume', () => {
    const timer = startTimer('pomodoro', 'focus', [], DEFAULT_SETTINGS, 1_000, 'one')
    const paused = pauseTimer(timer, 11_000)
    const resumed = resumeTimer(paused, 50_000)
    expect(elapsedMs(resumed, 55_000)).toBe(15_000)
  })

  it('caps focus credit at the Pomodoro duration', () => {
    const timer = startTimer('pomodoro', 'focus', ['a'], DEFAULT_SETTINGS, 0, 'one')
    expect(isComplete(timer, 2_000_000)).toBe(true)
    expect(finishTimer(timer, 2_000_000, true)?.focusedMs).toBe(1_500_000)
  })

  it('saves actual focused time when stopped early without completing the phase', () => {
    const timer = startTimer('pomodoro', 'focus', ['school'], DEFAULT_SETTINGS, 1_000, 'early')
    const record = finishTimer(timer, 91_000, false)
    expect(record).toMatchObject({ id: 'early', focusedMs: 90_000, completed: false, tagIds: ['school'] })
  })

  it('reconciles a restored overdue timer from timestamps', () => {
    const original = startTimer('pomodoro', 'focus', [], DEFAULT_SETTINGS, 1_000, 'restored')
    const restored = JSON.parse(JSON.stringify(original)) as typeof original
    expect(isComplete(restored, 1_501_000)).toBe(true)
    expect(finishTimer(restored, 1_501_000, true)?.id).toBe('restored')
  })

  it('offers a long break on the configured cadence', () => {
    let settings = DEFAULT_SETTINGS
    settings = settingsAfterCompletion(settings, 'focus')
    settings = settingsAfterCompletion(settings, 'focus')
    settings = settingsAfterCompletion(settings, 'focus')
    expect(settings.nextPhase).toBe('shortBreak')
    settings = settingsAfterCompletion(settings, 'focus')
    expect(settings.nextPhase).toBe('longBreak')
    expect(settings.completedFocusCount).toBe(0)
  })

  it('does not create records for breaks', () => {
    const timer = startTimer('pomodoro', 'shortBreak', [], DEFAULT_SETTINGS, 0, 'break')
    expect(finishTimer(timer, 300_000, true)).toBeNull()
  })

  it('deduplicates tags when a timer starts', () => {
    const timer = startTimer('stopwatch', 'focus', ['a', 'a', 'b'], DEFAULT_SETTINGS, 0, 'tags')
    expect(timer.tagIds).toEqual(['a', 'b'])
  })
})
