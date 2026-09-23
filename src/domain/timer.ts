import type { ActiveTimer, BlockSetup, Mode, Phase, SessionRecord } from './types'

export const phaseDurationMs = (phase: Phase, setup: BlockSetup): number =>
  (phase === 'focus' ? setup.focusMin : phase === 'shortBreak' ? setup.shortMin : setup.longMin) * 60_000

export const startTimer = (
  mode: Mode,
  phase: Phase,
  tagIds: string[],
  setup: BlockSetup,
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
  durationMs: mode === 'pomodoro' ? phaseDurationMs(phase, setup) : null,
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

/** Nothing under a minute of focus is kept when a run is cut short. */
export const MIN_SAVED_MS = 60_000

export const finishTimer = (timer: ActiveTimer, now: number, completed: boolean): SessionRecord | null => {
  const focusedMs = timer.phase === 'focus' ? elapsedMs(timer, now) : 0
  if (focusedMs <= 0 || (!completed && focusedMs < MIN_SAVED_MS)) return null
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
