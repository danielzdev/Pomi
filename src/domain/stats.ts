import { dayKey } from './blocks'
import type { BlockRecord, SessionRecord, Tag } from './types'

const MIN = 60_000
export type Period = 'D' | 'W' | 'M' | 'Y'

export interface DayStat {
  focusMs: number
  /** Pomodoro focus sessions started this day. */
  sessions: number
  finished: number
  /** Focused ms of each session ended early, and the time it fell short by. */
  early: { focusedMs: number; shortMs: number }[]
  blocks: number
  blocksFinished: number
  /** Sessions logged in blocks started this day. */
  blockSessions: number
  blockFocusMs: number
  /** Pomodoro sessions outside any block. */
  solo: number
}

const emptyDay = (): DayStat => ({ focusMs: 0, sessions: 0, finished: 0, early: [], blocks: 0, blocksFinished: 0, blockSessions: 0, blockFocusMs: 0, solo: 0 })

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const startOfDay = (at: number | Date) => { const d = new Date(at); return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }

/** Everything the statistics need, per local day. Sessions file under the day they started. */
export function buildDays(sessions: SessionRecord[], blocks: BlockRecord[]): Map<string, DayStat> {
  const days = new Map<string, DayStat>()
  const at = (key: string) => { let d = days.get(key); if (!d) { d = emptyDay(); days.set(key, d) } return d }
  const blockById = new Map(blocks.map(b => [b.id, b]))
  for (const s of sessions) {
    if (s.phase !== 'focus' || s.focusedMs <= 0) continue
    const d = at(dayKey(s.startedAt))
    d.focusMs += s.focusedMs
    if (s.mode !== 'pomodoro') continue
    d.sessions++
    const block = s.blockId ? blockById.get(s.blockId) : undefined
    const full = (block?.setup.focusMin ?? 0) * MIN
    // Finished vs early, judged against the setup the session's block started with.
    const finished = s.completed && (!block || s.focusedMs >= full)
    if (finished) d.finished++
    else d.early.push({ focusedMs: s.focusedMs, shortMs: Math.max(0, full - s.focusedMs) })
    if (!block) d.solo++
  }
  for (const b of blocks) {
    const own = sessions.filter(s => s.blockId === b.id && s.phase === 'focus')
    const d = at(dayKey(b.startedAt))
    d.blocks++
    d.blockSessions += own.length
    d.blockFocusMs += own.reduce((sum, s) => sum + s.focusedMs, 0)
    const full = b.setup.focusMin * MIN
    if (own.filter(s => s.completed && s.focusedMs >= full).length >= b.setup.sessions) d.blocksFinished++
  }
  return days
}

/** The first day with any focus, or today when there is none. */
export const firstDay = (days: Map<string, DayStat>, today: Date): Date => {
  const keys = [...days.entries()].filter(([, d]) => d.focusMs > 0).map(([k]) => k).sort()
  if (!keys.length) return startOfDay(today)
  const [y, m, d] = keys[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Weeks always start on Monday. */
export function periodRange(period: Period, offset: number, today: Date): { start: Date; end: Date } {
  const t = startOfDay(today)
  if (period === 'D') { const d = addDays(t, offset); return { start: d, end: d } }
  if (period === 'W') { const monday = addDays(t, -((t.getDay() + 6) % 7) + offset * 7); return { start: monday, end: addDays(monday, 6) } }
  if (period === 'M') return { start: new Date(t.getFullYear(), t.getMonth() + offset, 1), end: new Date(t.getFullYear(), t.getMonth() + offset + 1, 0) }
  return { start: new Date(t.getFullYear() + offset, 0, 1), end: new Date(t.getFullYear() + offset, 11, 31) }
}

export const eachDay = (start: Date, end: Date): Date[] => {
  const out: Date[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

export type CellState = 'counted' | 'missed' | 'today' | 'future' | 'before'

/** Binary: a day counts at or above the threshold. Today and future stay hollow until they count. */
export function cellState(day: Date, days: Map<string, DayStat>, today: Date, first: Date, thresholdMin: number): CellState {
  const t = startOfDay(today)
  const focused = (days.get(dayKey(day.getTime()))?.focusMs ?? 0) >= thresholdMin * MIN
  if (day > t) return 'future'
  if (day < first) return 'before'
  if (focused) return 'counted'
  return day.getTime() === t.getTime() ? 'today' : 'missed'
}

export interface Aggregate {
  focusMs: number; sessions: number; finished: number; earlyCount: number; earlyFocusMs: number; earlyShortMs: number
  blocks: number; blocksFinished: number; blockSessions: number; blockFocusMs: number; solo: number
  /** Days from first use through today inside the range. */
  elapsed: number; counted: number; longestRun: number
  best: { day: Date; focusMs: number } | null
}

export function aggregate(range: { start: Date; end: Date }, days: Map<string, DayStat>, today: Date, first: Date, thresholdMin: number): Aggregate {
  const a: Aggregate = { focusMs: 0, sessions: 0, finished: 0, earlyCount: 0, earlyFocusMs: 0, earlyShortMs: 0, blocks: 0, blocksFinished: 0, blockSessions: 0, blockFocusMs: 0, solo: 0, elapsed: 0, counted: 0, longestRun: 0, best: null }
  const t = startOfDay(today)
  let run = 0
  for (const day of eachDay(range.start, range.end)) {
    if (day < first || day > t) continue
    const d = days.get(dayKey(day.getTime())) ?? emptyDay()
    a.elapsed++
    a.focusMs += d.focusMs; a.sessions += d.sessions; a.finished += d.finished
    a.earlyCount += d.early.length
    a.earlyFocusMs += d.early.reduce((s, e) => s + e.focusedMs, 0)
    a.earlyShortMs += d.early.reduce((s, e) => s + e.shortMs, 0)
    a.blocks += d.blocks; a.blocksFinished += d.blocksFinished; a.blockSessions += d.blockSessions; a.blockFocusMs += d.blockFocusMs; a.solo += d.solo
    if (d.focusMs >= thresholdMin * MIN) { a.counted++; run++; a.longestRun = Math.max(a.longestRun, run) }
    else if (day.getTime() !== t.getTime()) run = 0
    if (d.focusMs > 0 && (!a.best || d.focusMs > a.best.focusMs)) a.best = { day, focusMs: d.focusMs }
  }
  return a
}

const counts = (days: Map<string, DayStat>, day: Date, thresholdMin: number) => (days.get(dayKey(day.getTime()))?.focusMs ?? 0) >= thresholdMin * MIN

/** Consecutive counted days up to today; today not counting yet doesn't break it. */
export function currentStreak(days: Map<string, DayStat>, today: Date, thresholdMin: number): number {
  let day = startOfDay(today), n = 0
  if (!counts(days, day, thresholdMin)) day = addDays(day, -1)
  while (counts(days, day, thresholdMin) && n < 100_000) { n++; day = addDays(day, -1) }
  return n
}

/** Every run of counted days, longest first. Changing the threshold recomputes all of them. */
export function streakRuns(days: Map<string, DayStat>, first: Date, today: Date, thresholdMin: number): { start: Date; end: Date; length: number }[] {
  const runs: { start: Date; end: Date; length: number }[] = []
  let current: { start: Date; end: Date; length: number } | null = null
  const t = startOfDay(today)
  for (const day of eachDay(first, t)) {
    if (counts(days, day, thresholdMin)) {
      current ??= { start: day, end: day, length: 0 }
      current.end = day; current.length++
    } else if (day.getTime() !== t.getTime()) {
      if (current) runs.push(current)
      current = null
    }
  }
  if (current) runs.push(current)
  return runs.sort((a, b) => b.length - a.length || b.end.getTime() - a.end.getTime())
}

export interface TagShare { tag: Tag | null; focusMs: number; sessions: number }

/** Focus per live tag within a range, plus an Untagged row (untagged stretches and deleted tags' time). */
export function tagShares(sessions: SessionRecord[], tags: Tag[], range: { start: Date; end: Date }): { rows: TagShare[]; untagged: TagShare } {
  const live = new Map(tags.filter(t => !t.deletedAt).map(t => [t.id, t]))
  const ms = new Map<string, number>(), count = new Map<string, number>()
  let untaggedMs = 0, untaggedSessions = 0
  const from = range.start.getTime(), to = addDays(range.end, 1).getTime()
  for (const s of sessions) {
    if (s.phase !== 'focus' || s.startedAt < from || s.startedAt >= to) continue
    const seen = new Set<string>()
    let hadUntagged = false
    for (const seg of s.segments) {
      const on = [...new Set(seg.tagIds)].filter(id => live.has(id))
      if (!on.length) { untaggedMs += seg.focusedMs; hadUntagged = true }
      for (const id of on) { ms.set(id, (ms.get(id) ?? 0) + seg.focusedMs); seen.add(id) }
    }
    for (const id of seen) count.set(id, (count.get(id) ?? 0) + 1)
    if (hadUntagged) untaggedSessions++
  }
  const rows = [...ms.entries()].map(([id, focusMs]) => ({ tag: live.get(id)!, focusMs, sessions: count.get(id) ?? 0 }))
    .sort((a, b) => b.focusMs - a.focusMs)
  return { rows, untagged: { tag: null, focusMs: untaggedMs, sessions: untaggedSessions } }
}

/** The most common session length and block setup in a range, for the breakdown sheets. */
export function mostUsedSetup(blocks: BlockRecord[], range: { start: Date; end: Date }): { focusMin: number; sessions: number } | null {
  const from = range.start.getTime(), to = addDays(range.end, 1).getTime()
  const tally = new Map<string, number>()
  for (const b of blocks) if (b.startedAt >= from && b.startedAt < to) {
    const k = `${b.setup.focusMin}×${b.setup.sessions}`
    tally.set(k, (tally.get(k) ?? 0) + 1)
  }
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
  if (!top) return null
  const [focusMin, n] = top[0].split('×').map(Number)
  return { focusMin, sessions: n }
}
