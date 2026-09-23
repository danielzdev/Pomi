import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './types'
import { clampDuration, migrateSettings } from './settings'

describe('settings', () => {
  it('migrates v1 settings and drops runtime fields', () => {
    const migrated = migrateSettings({
      focusMinutes: 50, completedFocusCount: 2, nextPhase: 'shortBreak',
      autoStartBreaks: false, autoStartAfterLongBreak: true, alertTone: 'woodBlock',
    })
    expect(migrated).toMatchObject({ focusMinutes: 50, autoStartShortBreaks: false, autoStartLongBreak: false, autoStartNextBlock: true, alertTone: 'Wood block' })
    expect(migrated).not.toHaveProperty('completedFocusCount')
    expect(migrated).not.toHaveProperty('nextPhase')
  })

  it('falls back to defaults for garbage', () => {
    expect(migrateSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(migrateSettings({ focusMinutes: 'x', alertTone: 'Kazoo', longBreakEvery: 500 })).toEqual({ ...DEFAULT_SETTINGS, longBreakEvery: 99 })
  })

  it('clamps typed durations with a message', () => {
    expect(clampDuration('focusMinutes', 0)).toEqual({ value: 1, message: 'Minimum is 1' })
    expect(clampDuration('longBreakEvery', 120)).toEqual({ value: 99, message: 'Maximum is 99' })
    expect(clampDuration('shortBreakMinutes', 7)).toEqual({ value: 7, message: null })
  })
})
