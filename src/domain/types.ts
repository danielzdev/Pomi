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
}

