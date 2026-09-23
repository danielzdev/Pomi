import type { SessionRecord, Tag } from './types'

export interface TagTotal extends Tag {
  focusedMs: number
}

export interface FocusMetrics {
  /** Wall focus time, counted once however many tags were on. */
  overallFocusedMs: number
  /** Each live tag credited with every stretch it was on. */
  byTag: TagTotal[]
  /** Stretches with no live tag, including time from deleted tags. */
  untaggedMs: number
}

const isLive = (tag: Tag) => !tag.deletedAt

export function calculateFocusMetrics(sessions: SessionRecord[], tags: Tag[]): FocusMetrics {
  const live = tags.filter(isLive)
  const totals = new Map(live.map((tag) => [tag.id, 0]))
  let overallFocusedMs = 0, untaggedMs = 0

  for (const session of sessions) {
    overallFocusedMs += session.focusedMs
    const segments = session.segments?.length ? session.segments
      : [{ startedAt: session.startedAt, endedAt: session.endedAt, tagIds: session.tagIds, focusedMs: session.focusedMs }]
    for (const segment of segments) {
      const on = [...new Set(segment.tagIds)].filter((id) => totals.has(id))
      if (on.length === 0) untaggedMs += segment.focusedMs
      for (const id of on) totals.set(id, (totals.get(id) ?? 0) + segment.focusedMs)
    }
  }

  return {
    overallFocusedMs,
    untaggedMs,
    byTag: live
      .map((tag) => ({ ...tag, focusedMs: totals.get(tag.id) ?? 0 }))
      .sort((a, b) => b.focusedMs - a.focusedMs),
  }
}
