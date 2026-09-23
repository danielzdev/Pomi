import type { ActiveTimer, BlockSetup, Mode, Phase, Segment, SessionRecord, TimerSegment } from './types'

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
  segments: [{ startedAt: now, endedAt: null, startElapsedMs: 0, endElapsedMs: null, tagIds: [...new Set(tagIds)] }],
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

/** The wall-clock end of a run: when a finished phase actually ran out, not when we noticed. */
export const effectiveEnd = (timer: ActiveTimer, now: number): number =>
  timer.durationMs !== null && timer.status === 'running' && timer.resumedAt !== null && isComplete(timer, now)
    ? Math.min(now, timer.resumedAt + (timer.durationMs - timer.accumulatedMs))
    : now

const closeOpen = (segments: TimerSegment[], now: number, elapsed: number): TimerSegment[] => {
  const last = segments[segments.length - 1]
  if (!last || last.endedAt !== null) return segments
  const closed = { ...last, endedAt: now, endElapsedMs: elapsed }
  // A stretch with no focused time in it is dropped.
  return closed.endElapsedMs > closed.startElapsedMs ? [...segments.slice(0, -1), closed] : segments.slice(0, -1)
}

/** Turning any tag on or off closes the running segment now and opens one with the new set. */
export const cutTags = (timer: ActiveTimer, tagIds: string[], now: number): ActiveTimer => {
  const next = [...new Set(tagIds)], elapsed = elapsedMs(timer, now)
  const segments = timer.segments ?? []
  return {
    ...timer,
    tagIds: next,
    segments: [...closeOpen(segments, now, elapsed), { startedAt: now, endedAt: null, startElapsedMs: elapsed, endElapsedMs: null, tagIds: next }],
  }
}

/** Remove a tag from a live timer everywhere (tag deleted), cutting if it was on. */
export const dropTag = (timer: ActiveTimer, tagId: string, now: number): ActiveTimer => {
  const cut = timer.tagIds.includes(tagId) ? cutTags(timer, timer.tagIds.filter(id => id !== tagId), now) : timer
  return { ...cut, segments: cut.segments.map(seg => seg.endedAt === null ? seg : { ...seg, tagIds: seg.tagIds.filter(id => id !== tagId) }) }
}

/** Closed segments of a run ending at `now`. Timers saved before segments existed get one. */
export const closedSegments = (timer: ActiveTimer, at: number): Segment[] => {
  const now = effectiveEnd(timer, at), elapsed = elapsedMs(timer, now)
  const segments = timer.segments?.length ? timer.segments
    : [{ startedAt: timer.startedAt, endedAt: null, startElapsedMs: 0, endElapsedMs: null, tagIds: timer.tagIds }]
  return closeOpen(segments, now, elapsed).map(seg => ({
    startedAt: seg.startedAt,
    endedAt: seg.endedAt ?? now,
    tagIds: seg.tagIds,
    focusedMs: (seg.endElapsedMs ?? elapsed) - seg.startElapsedMs,
  }))
}

/** Nothing under a minute of focus is kept when a run is cut short. */
export const MIN_SAVED_MS = 60_000

export const finishTimer = (timer: ActiveTimer, at: number, completed: boolean, blockId: string | null = null): SessionRecord | null => {
  const now = effectiveEnd(timer, at)
  const focusedMs = timer.phase === 'focus' ? elapsedMs(timer, now) : 0
  if (focusedMs <= 0 || (!completed && focusedMs < MIN_SAVED_MS)) return null
  const segments = closedSegments(timer, now)
  return {
    id: timer.id,
    mode: timer.mode,
    phase: timer.phase,
    startedAt: timer.startedAt,
    endedAt: now,
    focusedMs,
    completed,
    tagIds: [...new Set(segments.flatMap(seg => seg.tagIds))],
    segments,
    blockId,
  }
}
