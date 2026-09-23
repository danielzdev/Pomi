import { ALERT_TONES, DEFAULT_SETTINGS, type AlertTone, type Settings } from './types'

export type DurationKey = 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakEvery'

export const DURATION_LIMITS: Record<DurationKey, [number, number]> = {
  focusMinutes: [1, 999],
  shortBreakMinutes: [1, 999],
  longBreakMinutes: [1, 999],
  longBreakEvery: [1, 99],
}

/** Clamp a typed or stepped duration; `message` is the toast to show when it was out of range. */
export const clampDuration = (key: DurationKey, value: number): { value: number; message: string | null } => {
  const [lo, hi] = DURATION_LIMITS[key]
  if (value < lo) return { value: lo, message: `Minimum is ${lo}` }
  if (value > hi) return { value: hi, message: `Maximum is ${hi}` }
  return { value, message: null }
}

const LEGACY_TONES: Record<string, AlertTone> = { woodBlock: 'Wood block' }

/** Read stored settings from any earlier version, dropping runtime fields and fixing bad values. */
export const migrateSettings = (raw: unknown): Settings => {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS
  const stored = raw as Record<string, unknown>
  const next: Settings = { ...DEFAULT_SETTINGS }
  const bool = (key: keyof Settings, ...legacy: string[]) => {
    for (const name of [key, ...legacy]) if (typeof stored[name] === 'boolean') { (next as unknown as Record<string, unknown>)[key] = stored[name]; return }
  }
  for (const key of Object.keys(DURATION_LIMITS) as DurationKey[]) {
    const value = stored[key]
    if (typeof value === 'number' && Number.isFinite(value)) next[key] = clampDuration(key, Math.round(value)).value
  }
  bool('autoStartShortBreaks', 'autoStartBreaks')
  bool('autoStartLongBreak', 'autoStartBreaks')
  bool('autoStartSessions')
  bool('autoStartNextBlock', 'autoStartAfterLongBreak')
  bool('carryTags'); bool('confirmDelete'); bool('sound'); bool('vibrate'); bool('notifyWhenClosed'); bool('keepScreenAwake'); bool('stopwatchKeepsRunning')
  const tone = typeof stored.alertTone === 'string' ? LEGACY_TONES[stored.alertTone] ?? stored.alertTone : null
  if (tone && (ALERT_TONES as readonly string[]).includes(tone)) next.alertTone = tone as AlertTone
  if (typeof stored.streakThresholdMin === 'number' && stored.streakThresholdMin > 0) next.streakThresholdMin = Math.round(stored.streakThresholdMin)
  return next
}
