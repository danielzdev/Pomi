import type { ActiveTimer, Mode, Phase, SessionRecord, Settings } from './types'

export const phaseDurationMs = (phase: Phase, settings: Settings): number => {
  const minutes = phase === 'focus'
    ? settings.focusMinutes
    : phase === 'shortBreak'
      ? settings.shortBreakMinutes
      : settings.longBreakMinutes
  return minutes * 60_000
}

export const startTimer = (
  mode: Mode,
  phase: Phase,
  tagIds: string[],
  settings: Settings,
  now: number,
  id: string,
): ActiveTimer => ({
  id,
  mode,
  phase: mode === 'stopwatch' ? 'focus' : phase,
  status: 'running',
  startedAt: now,
  resumedAt: now,
  accumulatedMs: 0,
  pausedAt: null,
  durationMs: mode === 'pomodoro' ? phaseDurationMs(phase, settings) : null,
  tagIds: [...new Set(tagIds)],
})

export const elapsedMs = (timer: ActiveTimer, now: number): number => {
  const live = timer.status === 'running' && timer.resumedAt !== null
    ? Math.max(0, now - timer.resumedAt)
    : 0
  const elapsed = timer.accumulatedMs + live
  return timer.durationMs === null ? elapsed : Math.min(timer.durationMs, elapsed)
}

export const remainingMs = (timer: ActiveTimer, now: number): number | null =>
  timer.durationMs === null ? null : Math.max(0, timer.durationMs - elapsedMs(timer, now))

export const pauseTimer = (timer: ActiveTimer, now: number): ActiveTimer => ({
  ...timer,
  status: 'paused',
  accumulatedMs: elapsedMs(timer, now),
  pausedAt: now,
  resumedAt: null,
})

export const resumeTimer = (timer: ActiveTimer, now: number): ActiveTimer => ({
  ...timer,
  status: 'running',
  resumedAt: now,
  pausedAt: null,
})

export const isComplete = (timer: ActiveTimer, now: number): boolean =>
  timer.durationMs !== null && elapsedMs(timer, now) >= timer.durationMs

export const finishTimer = (timer: ActiveTimer, now: number, completed: boolean): SessionRecord | null => {
  const focusedMs = timer.phase === 'focus' ? elapsedMs(timer, now) : 0
  if (focusedMs <= 0) return null
  return {
    id: timer.id,
    mode: timer.mode,
    phase: timer.phase,
    startedAt: timer.startedAt,
    endedAt: now,
    focusedMs,
    completed,
    tagIds: timer.tagIds,
  }
}

export const settingsAfterCompletion = (settings: Settings, phase: Phase): Settings => {
  if (phase !== 'focus') return { ...settings, nextPhase: 'focus' }
  const count = settings.completedFocusCount + 1
  const longBreak = count >= settings.longBreakEvery
  return {
    ...settings,
    completedFocusCount: longBreak ? 0 : count,
    nextPhase: longBreak ? 'longBreak' : 'shortBreak',
  }
}
