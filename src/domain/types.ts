export type Mode = 'pomodoro' | 'stopwatch'
export type Phase = 'focus' | 'shortBreak' | 'longBreak'
export type TimerStatus = 'running' | 'paused'

export const ALERT_TONES = ['Wood block', 'Soft chime', 'Marimba', 'Bowl', 'Tick', 'Silent'] as const
export type AlertTone = typeof ALERT_TONES[number]

export interface Settings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  /** Sessions per block. */
  longBreakEvery: number
  autoStartShortBreaks: boolean
  autoStartLongBreak: boolean
  autoStartSessions: boolean
  autoStartNextBlock: boolean
  carryTags: boolean
  confirmDelete: boolean
  sound: boolean
  alertTone: AlertTone
  vibrate: boolean
  notifyWhenClosed: boolean
  keepScreenAwake: boolean
  stopwatchKeepsRunning: boolean
  /** Minutes of focus a day needs to count toward a streak. */
  streakThresholdMin: number
}

/** The durations a block runs with, frozen when it starts. */
export interface BlockSetup {
  focusMin: number
  shortMin: number
  longMin: number
  sessions: number
}

/** Runtime state of the block in progress. */
export interface BlockState {
  id: string
  startedAt: number
  setup: BlockSetup
  /** Focus sessions finished so far in this block. */
  completedFocus: number
  nextPhase: Phase
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

export type HubTab = 'settings' | 'statistics' | 'history'

export interface UiState {
  mode: Mode
  takeover: TakeoverState | null
  laps: StopwatchLap[]
  hubOpen: boolean
  hubTab: HubTab
  block: BlockState | null
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
  autoStartShortBreaks: true,
  autoStartLongBreak: true,
  autoStartSessions: false,
  autoStartNextBlock: false,
  carryTags: true,
  confirmDelete: true,
  sound: true,
  alertTone: 'Wood block',
  vibrate: true,
  notifyWhenClosed: true,
  keepScreenAwake: false,
  stopwatchKeepsRunning: true,
  streakThresholdMin: 120,
}

export const setupFromSettings = (settings: Settings): BlockSetup => ({
  focusMin: settings.focusMinutes,
  shortMin: settings.shortBreakMinutes,
  longMin: settings.longBreakMinutes,
  sessions: settings.longBreakEvery,
})

export const DEFAULT_UI_STATE: UiState = {
  mode: 'pomodoro',
  takeover: null,
  laps: [],
  hubOpen: false,
  hubTab: 'settings',
  block: null,
}
