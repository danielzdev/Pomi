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
  /** Saved sessions and finished breaks so far, for the block record. */
  sessionIds: string[]
  breaks: BreakRecord[]
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

export const TAG_PALETTE = ['#B96A1A', '#2F5F57', '#58806F', '#A8512B', '#8A8175', '#7FA294', '#B4AFA2', '#8A6420'] as const

/** Brighter variants for dots on dark or selected chips. */
export const TAG_BRIGHT: Record<string, string> = {
  '#B96A1A': '#E5A24F', '#2F5F57': '#7FA294', '#58806F': '#8FB9A6', '#A8512B': '#D08055',
  '#8A8175': '#BDB5A7', '#7FA294': '#9FC4B6', '#B4AFA2': '#D3CDC1', '#8A6420': '#D0A45C',
}

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: number
  /** Set while a delete can still be undone; the tag counts as gone. */
  deletedAt?: number | null
}

/** A stretch of one timer run with one tag set. Elapsed values exclude pauses. */
export interface TimerSegment {
  startedAt: number
  endedAt: number | null
  startElapsedMs: number
  endElapsedMs: number | null
  tagIds: string[]
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
  /** Tags on right now (the open segment's set). */
  tagIds: string[]
  /** The last one is open (`endedAt: null`). */
  segments: TimerSegment[]
}

/** A closed stretch of a saved session. */
export interface Segment {
  startedAt: number
  endedAt: number
  tagIds: string[]
  focusedMs: number
}

export interface SessionRecord {
  id: string
  mode: Mode
  phase: Phase
  startedAt: number
  endedAt: number
  focusedMs: number
  completed: boolean
  /** Union of the segments' tags, for quick filtering. */
  tagIds: string[]
  segments: Segment[]
  blockId: string | null
  laps?: StopwatchLap[]
}

export interface BreakRecord {
  kind: 'short' | 'long'
  startedAt: number
  endedAt: number
}

export interface BlockRecord {
  id: string
  startedAt: number
  endedAt: number
  setup: BlockSetup
  sessionIds: string[]
  breaks: BreakRecord[]
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
