import type { Mode, Phase, Settings, StopwatchLap, TakeoverState } from './types'
import { MIN_SAVED_MS } from './timer'

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

/** Wall time of a whole block: sessions + short breaks between them + the long break. */
export const blockTotalMinutes = (settings: Pick<Settings, 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakEvery'>): number =>
  settings.focusMinutes * settings.longBreakEvery
  + settings.shortBreakMinutes * Math.max(0, settings.longBreakEvery - 1)
  + settings.longBreakMinutes

/**
 * Wall time left in the block, counting the running phase's remaining time plus every
 * session and break still to come (short breaks between sessions, then the long break).
 * `completed` is the number of focus sessions already finished.
 */
export const blockMinutesLeft = (settings: Settings, phase: Phase, completed: number, phaseRemainingMs: number): number => {
  const sessionsAfter = Math.max(0, settings.longBreakEvery - completed - (phase === 'focus' ? 1 : 0))
  if (phase === 'longBreak') return Math.ceil(phaseRemainingMs / 60_000)
  const shortsAfter = phase === 'focus' ? sessionsAfter : Math.max(0, sessionsAfter - 1)
  return Math.ceil((phaseRemainingMs
    + (sessionsAfter * settings.focusMinutes + shortsAfter * settings.shortBreakMinutes + settings.longBreakMinutes) * 60_000) / 60_000)
}

export interface SwitchPrompt { title: string; body: string }

/** Copy for the 13D mode-switch confirm. */
export const modeSwitchPrompt = (from: Mode, context:
  | { kind: 'focus'; sessionNumber: number; focusedMs: number }
  | { kind: 'break' }
  | { kind: 'stopwatch'; elapsedMs: number; laps: number; display: string }): SwitchPrompt => {
  const title = from === 'pomodoro' ? 'Switch to Stopwatch?' : 'Switch to Pomodoro?'
  if (context.kind === 'break') return { title, body: 'This ends the break and the block. Nothing more is saved.' }
  const lessThanMinute = 'Less than a minute, so nothing is saved.'
  if (context.kind === 'focus') {
    const lead = `This ends session ${String(context.sessionNumber).padStart(2, '0')}.`
    if (context.focusedMs < MIN_SAVED_MS) return { title, body: `${lead} ${lessThanMinute}` }
    const s = Math.floor(context.focusedMs / 1000)
    return { title, body: `${lead} The ${Math.floor(s / 60)} m ${s % 60} s you've focused is saved.` }
  }
  if (context.elapsedMs < MIN_SAVED_MS) return { title, body: `This stops the stopwatch. ${lessThanMinute}` }
  const laps = context.laps ? ` and ${context.laps} lap${context.laps === 1 ? '' : 's'} are saved.` : ' is saved.'
  return { title, body: `This stops the stopwatch. ${context.display}${laps}` }
}
