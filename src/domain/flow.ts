import { setupFromSettings, type BlockSetup, type BlockState, type Mode, type Phase, type Settings, type StopwatchLap, type TakeoverState } from './types'
import { MIN_SAVED_MS } from './timer'

export const AUTO_START_MS = 5_000

export const startBlock = (settings: Settings, now: number, id: string): BlockState => ({
  id, startedAt: now, setup: setupFromSettings(settings), completedFocus: 0, nextPhase: 'focus', sessionIds: [], breaks: [],
})

/** Advance the block after a phase runs to completion. */
export const blockAfterCompletion = (block: BlockState, phase: Phase): BlockState => {
  if (phase !== 'focus') return { ...block, nextPhase: 'focus' }
  const completedFocus = Math.min(block.setup.sessions, block.completedFocus + 1)
  return { ...block, completedFocus, nextPhase: completedFocus >= block.setup.sessions ? 'longBreak' : 'shortBreak' }
}

/** Which takeover follows a completed phase. `block` is the block after `blockAfterCompletion`. */
export const takeoverAfterCompletion = (phase: Phase, block: BlockState, settings: Settings, now: number): TakeoverState => {
  const blockFinished = phase === 'longBreak' && !settings.autoStartNextBlock
  const auto = blockFinished ? false
    : phase === 'focus' ? (block.nextPhase === 'longBreak' ? settings.autoStartLongBreak : settings.autoStartShortBreaks)
      : phase === 'shortBreak' ? settings.autoStartSessions
        : settings.autoStartNextBlock
  return {
    kind: blockFinished ? 'blockFinished' : phase === 'focus' ? 'sessionOver' : 'breakOver',
    phase,
    sessionNumber: block.completedFocus,
    completedAt: now,
    auto,
    countdownStartedAt: auto ? now : null,
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
export const blockTotalMinutes = (setup: BlockSetup): number =>
  setup.focusMin * setup.sessions + setup.shortMin * Math.max(0, setup.sessions - 1) + setup.longMin

/**
 * Wall time left in the block, counting the running phase's remaining time plus every
 * session and break still to come (short breaks between sessions, then the long break).
 * `completed` is the number of focus sessions already finished.
 */
export const blockMinutesLeft = (setup: BlockSetup, phase: Phase, completed: number, phaseRemainingMs: number): number => {
  const sessionsAfter = Math.max(0, setup.sessions - completed - (phase === 'focus' ? 1 : 0))
  if (phase === 'longBreak') return Math.ceil(phaseRemainingMs / 60_000)
  const shortsAfter = phase === 'focus' ? sessionsAfter : Math.max(0, sessionsAfter - 1)
  return Math.ceil((phaseRemainingMs
    + (sessionsAfter * setup.focusMin + shortsAfter * setup.shortMin + setup.longMin) * 60_000) / 60_000)
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
