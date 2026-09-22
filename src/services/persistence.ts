import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DEFAULT_SETTINGS, type ActiveTimer, type SessionRecord, type Settings, type Tag } from '../domain/types'

const SETTINGS_KEY = 'pomi.settings.v1'
const ACTIVE_KEY = 'pomi.active.v1'
const WEB_TAGS_KEY = 'pomi.tags.v1'
const WEB_SESSIONS_KEY = 'pomi.sessions.v1'
let db: SQLiteDBConnection | null = null
let initialization: Promise<void> | null = null

const readWeb = <T>(key: string, fallback: T): T => {
  const value = localStorage.getItem(key)
  if (!value) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}

export async function initializePersistence(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (!initialization) {
    initialization = (async () => {
      const sqlite = new SQLiteConnection(CapacitorSQLite)
      db = await sqlite.createConnection('pomi', false, 'no-encryption', 1, false)
      await db.open()
      await db.execute(`
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY NOT NULL,
          mode TEXT NOT NULL,
          phase TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          ended_at INTEGER NOT NULL,
          focused_ms INTEGER NOT NULL,
          completed INTEGER NOT NULL,
          tag_ids TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_state (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `)
    })()
  }
  await initialization
}

export async function loadSettings(): Promise<Settings> {
  const { value } = await Preferences.get({ key: SETTINGS_KEY })
  if (!value) return DEFAULT_SETTINGS
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(value) as Settings } } catch { return DEFAULT_SETTINGS }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) })
}

export async function loadActiveTimer(): Promise<ActiveTimer | null> {
  if (db) {
    const result = await db.query('SELECT value FROM app_state WHERE key = ?', [ACTIVE_KEY])
    const value = result.values?.[0]?.value as string | undefined
    if (!value) return null
    try { return JSON.parse(value) as ActiveTimer } catch { return null }
  }
  const { value } = await Preferences.get({ key: ACTIVE_KEY })
  if (!value) return null
  try { return JSON.parse(value) as ActiveTimer } catch { return null }
}

export async function saveActiveTimer(timer: ActiveTimer | null): Promise<void> {
  if (db) {
    if (timer) {
      await db.run('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [ACTIVE_KEY, JSON.stringify(timer)])
    } else {
      await db.run('DELETE FROM app_state WHERE key = ?', [ACTIVE_KEY])
    }
    return
  }
  if (timer) await Preferences.set({ key: ACTIVE_KEY, value: JSON.stringify(timer) })
  else await Preferences.remove({ key: ACTIVE_KEY })
}

export async function listTags(): Promise<Tag[]> {
  if (!db) return readWeb<Tag[]>(WEB_TAGS_KEY, []).sort((a, b) => a.createdAt - b.createdAt)
  const result = await db.query('SELECT id, name, created_at AS createdAt FROM tags ORDER BY created_at')
  return (result.values ?? []) as Tag[]
}

export async function addTag(tag: Tag): Promise<void> {
  if (!db) {
    const tags = readWeb<Tag[]>(WEB_TAGS_KEY, [])
    localStorage.setItem(WEB_TAGS_KEY, JSON.stringify([...tags, tag]))
    return
  }
  await db.run('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)', [tag.id, tag.name, tag.createdAt])
}

export async function listSessions(): Promise<SessionRecord[]> {
  if (!db) return readWeb<SessionRecord[]>(WEB_SESSIONS_KEY, []).sort((a, b) => b.endedAt - a.endedAt)
  const result = await db.query('SELECT * FROM sessions ORDER BY ended_at DESC')
  return (result.values ?? []).map((row) => ({
    id: row.id as string,
    mode: row.mode as SessionRecord['mode'],
    phase: row.phase as SessionRecord['phase'],
    startedAt: row.started_at as number,
    endedAt: row.ended_at as number,
    focusedMs: row.focused_ms as number,
    completed: Boolean(row.completed),
    tagIds: JSON.parse(row.tag_ids as string) as string[],
  }))
}

export async function saveSession(session: SessionRecord): Promise<void> {
  if (!db) {
    const sessions = readWeb<SessionRecord[]>(WEB_SESSIONS_KEY, [])
    if (!sessions.some((item) => item.id === session.id)) {
      localStorage.setItem(WEB_SESSIONS_KEY, JSON.stringify([session, ...sessions]))
    }
    return
  }
  await db.run(
    'INSERT OR IGNORE INTO sessions (id, mode, phase, started_at, ended_at, focused_ms, completed, tag_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [session.id, session.mode, session.phase, session.startedAt, session.endedAt, session.focusedMs, session.completed ? 1 : 0, JSON.stringify(session.tagIds)],
  )
}
