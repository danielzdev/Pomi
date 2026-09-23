import type { BlockRecord, BlockState, BreakRecord, SessionRecord } from './types'

export const withSession = (block: BlockState, sessionId: string): BlockState =>
  block.sessionIds.includes(sessionId) ? block : { ...block, sessionIds: [...block.sessionIds, sessionId] }

export const withBreak = (block: BlockState, entry: BreakRecord): BlockState =>
  entry.endedAt > entry.startedAt ? { ...block, breaks: [...block.breaks, entry] } : block

/** The record kept when a block ends. A block with no saved session leaves nothing behind. */
export const blockRecordFrom = (block: BlockState, endedAt: number): BlockRecord | null =>
  block.sessionIds.length === 0 ? null : {
    id: block.id, startedAt: block.startedAt, endedAt, setup: block.setup,
    sessionIds: [...block.sessionIds], breaks: [...block.breaks],
  }

/** Local calendar day, used to file a block under the day it started. */
export const dayKey = (at: number): string => {
  const d = new Date(at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface BlockJudgement { finished: number; early: number; notStarted: number; focusedMs: number }

/**
 * Finished vs early, judged against the setup the block started with: a session finished
 * when it ran its block's full session length.
 */
export const judgeBlock = (block: BlockRecord, sessions: SessionRecord[]): BlockJudgement => {
  const own = sessions.filter(s => s.blockId === block.id && s.phase === 'focus')
  const full = block.setup.focusMin * 60_000
  const finished = own.filter(s => s.completed && s.focusedMs >= full).length
  return {
    finished,
    early: own.length - finished,
    notStarted: Math.max(0, block.setup.sessions - own.length),
    focusedMs: own.reduce((sum, s) => sum + s.focusedMs, 0),
  }
}

/** Blocks grouped under the day each started, newest day first, earliest block first within a day. */
export const groupByDay = (blocks: BlockRecord[]): { day: string; blocks: BlockRecord[] }[] => {
  const days = new Map<string, BlockRecord[]>()
  for (const block of [...blocks].sort((a, b) => a.startedAt - b.startedAt)) {
    const key = dayKey(block.startedAt)
    days.set(key, [...(days.get(key) ?? []), block])
  }
  return [...days.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, list]) => ({ day, blocks: list }))
}
