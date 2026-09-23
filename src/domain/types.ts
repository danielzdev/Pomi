export type Mode = 'pomodoro' | 'stopwatch'
export type Phase = 'focus' | 'shortBreak' | 'longBreak'
export type TimerStatus = 'running' | 'paused'

export interface Settings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakEvery: number
  completedFocusCount: number
  nextPhase: Phase
  autoStartBreaks: boolean
  autoStartSessions: boolean
  autoStartAfterLongBreak: boolean
  sound: boolean
  alertTone: 'woodBlock'
  vibrate: boolean
  notifyWhenClosed: boolean
  keepScreenAwake: boolean
  stopwatchKeepsRunning: boolean
}

export type TakeoverKind = 'sessionOver' | 'breakOver' | 'blockFinished'

export interface TakeoverState {
  kind: TakeoverKind
  phase: Phase
  sessionNumber: number
  completedAt: number
  auto: boolean
  countdownStartedAt: number | null
  countdownAccumulatedMs: number
  countdownPaused: boolean
}

export interface StopwatchLap {
  id: string
  splitMs: number
  durationMs: number
}

export interface UiState {
  mode: Mode
  takeover: TakeoverState | null
  laps: StopwatchLap[]
}

export interface Tag {
  id: string
  name: string
  createdAt: number
}

export interface ActiveTimer {
  id: string
  mode: Mode
  phase: Phase
  status: TimerStatus
  startedAt: number
  resumedAt: number | null
  accumulatedMs: number
  pausedAt?: number | null
  durationMs: number | null
  tagIds: string[]
}

export interface SessionRecord {
  id: string
  mode: Mode
  phase: Phase
  startedAt: number
  endedAt: number
  focusedMs: number
  completed: boolean
  tagIds: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  completedFocusCount: 0,
  nextPhase: 'focus',
  autoStartBreaks: true,
  autoStartSessions: false,
  autoStartAfterLongBreak: false,
  sound: true,
  alertTone: 'woodBlock',
  vibrate: true,
  notifyWhenClosed: true,
  keepScreenAwake: false,
  stopwatchKeepsRunning: true,
}

export const DEFAULT_UI_STATE: UiState = {
  mode: 'pomodoro',
  takeover: null,
  laps: [],
}
