import type { ActiveTimer } from '../domain/types'

export const pad2 = (n: number) => String(n).padStart(2, '0')

export const formatClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}

export const formatStopwatch = (ms: number) => {
  const cs = Math.floor(Math.max(0, ms) / 10), s = Math.floor(cs / 100)
  return { main: `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`, fraction: `.${pad2(cs % 100)}` }
}

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
