import type { SessionRecord, Tag } from './types'

export interface TagTotal extends Tag {
  focusedMs: number
}

export interface FocusMetrics {
  overallFocusedMs: number
  byTag: TagTotal[]
}

export function calculateFocusMetrics(sessions: SessionRecord[], tags: Tag[]): FocusMetrics {
  const totals = new Map(tags.map((tag) => [tag.id, 0]))
  let overallFocusedMs = 0

  for (const session of sessions) {
    overallFocusedMs += session.focusedMs
    for (const tagId of new Set(session.tagIds)) {
      if (totals.has(tagId)) totals.set(tagId, (totals.get(tagId) ?? 0) + session.focusedMs)
    }
  }

  return {
    overallFocusedMs,
    byTag: tags
      .map((tag) => ({ ...tag, focusedMs: totals.get(tag.id) ?? 0 }))
      .sort((a, b) => b.focusedMs - a.focusedMs),
  }
}

