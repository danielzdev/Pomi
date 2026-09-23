import type { Phase, Settings, StopwatchLap, TakeoverState } from './types'

export const AUTO_START_MS = 5_000

export const takeoverAfterCompletion = (
  phase: Phase,
  settings: Settings,
  sessionNumber: number,
  now: number,
): TakeoverState => {
  const blockFinished = phase === 'longBreak' && !settings.autoStartAfterLongBreak
  const auto = phase === 'focus'
    ? settings.autoStartBreaks
    : phase === 'shortBreak'
      ? settings.autoStartSessions
      : settings.autoStartAfterLongBreak
  return {
    kind: blockFinished ? 'blockFinished' : phase === 'focus' ? 'sessionOver' : 'breakOver',
    phase,
    sessionNumber,
    completedAt: now,
    auto: blockFinished ? false : auto,
    countdownStartedAt: auto && !blockFinished ? now : null,
    countdownAccumulatedMs: 0,
    countdownPaused: false,
  }
}

export const countdownElapsedMs = (state: TakeoverState, now: number): number =>
  Math.min(AUTO_START_MS, state.countdownAccumulatedMs + (
    state.auto && !state.countdownPaused && state.countdownStartedAt !== null
      ? Math.max(0, now - state.countdownStartedAt)
      : 0
  ))

export const pauseTakeover = (state: TakeoverState, now: number): TakeoverState => ({
  ...state,
  countdownAccumulatedMs: countdownElapsedMs(state, now),
  countdownStartedAt: null,
  countdownPaused: true,
})

export const addStopwatchLap = (laps: StopwatchLap[], splitMs: number, id: string): StopwatchLap[] => {
  const previousSplit = laps[0]?.splitMs ?? 0
  return [{ id, splitMs, durationMs: Math.max(0, splitMs - previousSplit) }, ...laps]
}
