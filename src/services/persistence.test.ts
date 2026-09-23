import { beforeEach, describe, expect, it } from 'vitest'
import type { BlockRecord, SessionRecord, Tag } from '../domain/types'
import { deleteBlock, listBlocks, listSessions, listTags, purgeTag, saveBlock, saveSession, saveTag } from './persistence'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const record = (id: string, blockId: string | null, tagIds: string[] = []): SessionRecord => ({
  id, mode: 'pomodoro', phase: 'focus', startedAt: 0, endedAt: 60_000, focusedMs: 60_000, completed: true,
  tagIds, segments: [{ startedAt: 0, endedAt: 60_000, tagIds, focusedMs: 60_000 }], blockId,
})

describe('persistence (web fallback)', () => {
  beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true }) })

  it('stores a completion idempotently', async () => {
    await saveSession(record('same', null))
    await saveSession(record('same', null))
    expect(await listSessions()).toEqual([record('same', null)])
  })

  it('reads a pre-segment record as one stretch', async () => {
    localStorage.setItem('pomi.sessions.v1', JSON.stringify([{ id: 'old', mode: 'pomodoro', phase: 'focus', startedAt: 0, endedAt: 5, focusedMs: 5, completed: true, tagIds: ['a'] }]))
    const [old] = await listSessions()
    expect(old.segments).toEqual([{ startedAt: 0, endedAt: 5, tagIds: ['a'], focusedMs: 5 }])
    expect(old.blockId).toBeNull()
  })

  it('gives old tags a colour and purges a deleted tag from records', async () => {
    localStorage.setItem('pomi.tags.v1', JSON.stringify([{ id: 'a', name: 'A', createdAt: 1 }]))
    expect((await listTags())[0].color).toBe('#B96A1A')
    const b: Tag = { id: 'b', name: 'B', color: '#58806F', createdAt: 2 }
    await saveTag(b)
    await saveSession(record('s', null, ['a', 'b']))
    await purgeTag('b')
    expect((await listTags()).map(t => t.id)).toEqual(['a'])
    const [s] = await listSessions()
    expect(s.tagIds).toEqual(['a'])
    expect(s.segments[0].tagIds).toEqual(['a'])
    expect(s.focusedMs).toBe(60_000)
  })

  it('deletes a block together with its sessions', async () => {
    const block: BlockRecord = { id: 'blk', startedAt: 0, endedAt: 1, setup: { focusMin: 25, shortMin: 5, longMin: 15, sessions: 4 }, sessionIds: ['s1'], breaks: [] }
    await saveBlock(block)
    await saveSession(record('s1', 'blk'))
    await saveSession(record('s2', null))
    await deleteBlock('blk')
    expect(await listBlocks()).toEqual([])
    expect((await listSessions()).map(s => s.id)).toEqual(['s2'])
  })
})
