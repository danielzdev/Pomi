import { beforeEach, describe, expect, it } from 'vitest'
import type { SessionRecord } from '../domain/types'
import { listSessions, saveSession } from './persistence'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const record: SessionRecord = {
  id: 'same-session',
  mode: 'pomodoro',
  phase: 'focus',
  startedAt: 0,
  endedAt: 60_000,
  focusedMs: 60_000,
  completed: true,
  tagIds: [],
}

describe('session persistence', () => {
  beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true }) })

  it('stores a completion idempotently', async () => {
    await saveSession(record)
    await saveSession(record)
    expect(await listSessions()).toEqual([record])
  })
})
