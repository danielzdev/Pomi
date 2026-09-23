import type { ActiveTimer } from '../domain/types'

export const pad2 = (n: number) => String(n).padStart(2, '0')

export const formatClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}

export type StopwatchStep = 'minutes' | 'hours' | 'tenHours'

/** Under 1 h `04:12` + `.68`; 1–10 h `3:12:40`; 10–24 h `12:47:09`. Hundredths go once there are hours. */
export const formatStopwatch = (ms: number): { main: string; fraction: string; step: StopwatchStep } => {
  const cs = Math.floor(Math.max(0, ms) / 10), s = Math.floor(cs / 100), h = Math.floor(s / 3600)
  if (h < 1) return { main: `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`, fraction: `.${pad2(cs % 100)}`, step: 'minutes' }
  return { main: `${h}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`, fraction: '', step: h < 10 ? 'hours' : 'tenHours' }
}

/** Lap splits keep their hundredths: `05:12.40`, or `1:02:14.30` past an hour. */
export const formatLap = (ms: number) => {
  const cs = Math.floor(Math.max(0, ms) / 10), s = Math.floor(cs / 100), h = Math.floor(s / 3600)
  const rest = `${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}.${pad2(cs % 100)}`
  return h ? `${h}:${rest}` : rest
}

/** Lap numbers pad to three digits once there are more than 99. */
export const lapNumber = (n: number, count: number) => String(n).padStart(count > 99 ? 3 : 2, '0')

/** "25 min", "2 h", "2 h 10 m" */
export const compactDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60), m = minutes % 60
  return h ? `${h} h${m ? ` ${m} m` : ''}` : `${m} min`
}

/** "7 m 18 s" */
export const minutesSeconds = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)} m ${s % 60} s`
}

export const pausedFor = (timer: ActiveTimer, now: number) => minutesSeconds(now - (timer.pausedAt ?? now))
