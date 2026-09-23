import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import { migrateSettings } from '../domain/settings'
import { stripTag, withColors } from '../domain/tags'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE, type ActiveTimer, type BlockRecord, type SessionRecord, type Settings, type Tag, type UiState } from '../domain/types'

const SETTINGS_KEY = 'pomi.settings.v1'
const ACTIVE_KEY = 'pomi.active.v1'
const UI_STATE_KEY = 'pomi.ui.v2'
const WEB_TAGS_KEY = 'pomi.tags.v1'
const WEB_SESSIONS_KEY = 'pomi.sessions.v1'
const WEB_BLOCKS_KEY = 'pomi.blocks.v1'
const SCHEMA_VERSION = 2
let db: SQLiteDBConnection | null = null
let initialization: Promise<void> | null = null

const readWeb = <T>(key: string, fallback: T): T => {
  const value = localStorage.getItem(key)
  if (!value) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}
const writeWeb = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))

/** Additive schema steps, run once each in order (PRAGMA user_version). */
const MIGRATIONS: Record<number, string> = {
  2: `
    ALTER TABLE tags ADD COLUMN color TEXT NOT NULL DEFAULT '';
    ALTER TABLE tags ADD COLUMN deleted_at INTEGER;
    ALTER TABLE sessions ADD COLUMN segments TEXT;
    ALTER TABLE sessions ADD COLUMN block_id TEXT;
    ALTER TABLE sessions ADD COLUMN laps TEXT;
    CREATE INDEX IF NOT EXISTS sessions_block ON sessions (block_id);
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      setup TEXT NOT NULL,
      session_ids TEXT NOT NULL,
      breaks TEXT NOT NULL
    );
  `,
}

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string' || !value) return fallback
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
      const version = Number((await db.query('PRAGMA user_version')).values?.[0]?.user_version ?? 0)
      for (let next = Math.max(version, 1) + 1; next <= SCHEMA_VERSION; next++) {
        await db.execute(`${MIGRATIONS[next]} PRAGMA user_version = ${next};`)
      }
    })()
  }
  await initialization
}

export async function loadSettings(): Promise<Settings> {
  const { value } = await Preferences.get({ key: SETTINGS_KEY })
  if (!value) return DEFAULT_SETTINGS
  try { return migrateSettings(JSON.parse(value)) } catch { return DEFAULT_SETTINGS }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) })
}

export async function loadUiState(): Promise<UiState> {
  const { value } = await Preferences.get({ key: UI_STATE_KEY })
  if (!value) return DEFAULT_UI_STATE
  try {
    const stored = JSON.parse(value) as Partial<UiState>
    return { ...DEFAULT_UI_STATE, ...stored, laps: Array.isArray(stored.laps) ? stored.laps : [], block: stored.block ?? null }
  } catch { return DEFAULT_UI_STATE }
}

export async function saveUiState(state: UiState): Promise<void> {
  await Preferences.set({ key: UI_STATE_KEY, value: JSON.stringify(state) })
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

const rowToTag = (row: Record<string, unknown>): Tag => ({
  id: row.id as string,
  name: row.name as string,
  color: (row.color as string) || '',
  createdAt: row.created_at as number,
  deletedAt: (row.deleted_at as number | null) ?? null,
})

/** Every tag, including ones deleted within the undo window (`deletedAt` set). */
export async function listTags(): Promise<Tag[]> {
  if (!db) return withColors(readWeb<Tag[]>(WEB_TAGS_KEY, []).sort((a, b) => a.createdAt - b.createdAt))
  const result = await db.query('SELECT * FROM tags ORDER BY created_at')
  return withColors((result.values ?? []).map(rowToTag))
}

/** Insert or update a tag (rename, recolour, soft delete, restore). */
export async function saveTag(tag: Tag): Promise<void> {
  if (!db) {
    const tags = readWeb<Tag[]>(WEB_TAGS_KEY, [])
    writeWeb(WEB_TAGS_KEY, tags.some(t => t.id === tag.id) ? tags.map(t => t.id === tag.id ? tag : t) : [...tags, tag])
    return
  }
  await db.run(
    'INSERT OR REPLACE INTO tags (id, name, color, created_at, deleted_at) VALUES (?, ?, ?, ?, ?)',
    [tag.id, tag.name, tag.color, tag.createdAt, tag.deletedAt ?? null],
  )
}

/** Remove a tag for good once its undo window has passed. Its logged time becomes untagged. */
export async function purgeTag(tagId: string): Promise<void> {
  const touched = (await listSessions()).filter(s => s.tagIds.includes(tagId) || s.segments.some(seg => seg.tagIds.includes(tagId)))
  if (!db) {
    writeWeb(WEB_TAGS_KEY, readWeb<Tag[]>(WEB_TAGS_KEY, []).filter(t => t.id !== tagId))
    const stripped = new Map(touched.map(s => [s.id, stripTag(s, tagId)]))
    writeWeb(WEB_SESSIONS_KEY, readWeb<SessionRecord[]>(WEB_SESSIONS_KEY, []).map(s => stripped.get(s.id) ?? s))
    return
  }
  const statements = [
    { statement: 'DELETE FROM tags WHERE id = ?', values: [tagId] },
    ...touched.map(s => stripTag(s, tagId)).map(s => ({ statement: 'UPDATE sessions SET tag_ids = ?, segments = ? WHERE id = ?', values: [JSON.stringify(s.tagIds), JSON.stringify(s.segments), s.id] })),
  ]
  await db.executeSet(statements)
}

const rowToSession = (row: Record<string, unknown>): SessionRecord => {
  const tagIds = parseJson<string[]>(row.tag_ids, [])
  const session: SessionRecord = {
    id: row.id as string,
    mode: row.mode as SessionRecord['mode'],
    phase: row.phase as SessionRecord['phase'],
    startedAt: row.started_at as number,
    endedAt: row.ended_at as number,
    focusedMs: row.focused_ms as number,
    completed: Boolean(row.completed),
    tagIds,
    segments: parseJson(row.segments, []),
    blockId: (row.block_id as string | null) ?? null,
  }
  const laps = parseJson(row.laps, null)
  return laps ? { ...session, laps } : session
}

/** Records from before segments existed read as one stretch. */
const normalizeSession = (session: SessionRecord): SessionRecord => ({
  ...session,
  blockId: session.blockId ?? null,
  segments: session.segments?.length ? session.segments
    : [{ startedAt: session.startedAt, endedAt: session.endedAt, tagIds: session.tagIds, focusedMs: session.focusedMs }],
})

export async function listSessions(): Promise<SessionRecord[]> {
  if (!db) return readWeb<SessionRecord[]>(WEB_SESSIONS_KEY, []).map(normalizeSession).sort((a, b) => b.endedAt - a.endedAt)
  const result = await db.query('SELECT * FROM sessions ORDER BY ended_at DESC')
  return (result.values ?? []).map(rowToSession).map(normalizeSession)
}

const sessionValues = (s: SessionRecord) => [
  s.id, s.mode, s.phase, s.startedAt, s.endedAt, s.focusedMs, s.completed ? 1 : 0,
  JSON.stringify(s.tagIds), JSON.stringify(s.segments), s.blockId, s.laps ? JSON.stringify(s.laps) : null,
]

/** Save a finished run once; a repeat with the same id is ignored. */
export async function saveSession(session: SessionRecord): Promise<void> {
  if (!db) {
    const sessions = readWeb<SessionRecord[]>(WEB_SESSIONS_KEY, [])
    if (!sessions.some((item) => item.id === session.id)) writeWeb(WEB_SESSIONS_KEY, [session, ...sessions])
    return
  }
  await db.run('INSERT OR IGNORE INTO sessions (id, mode, phase, started_at, ended_at, focused_ms, completed, tag_ids, segments, block_id, laps) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', sessionValues(session))
}

/** Rewrite a saved session's tags (retagging from History). Time boundaries never change. */
export async function updateSessionTags(session: SessionRecord): Promise<void> {
  if (!db) {
    writeWeb(WEB_SESSIONS_KEY, readWeb<SessionRecord[]>(WEB_SESSIONS_KEY, []).map(s => s.id === session.id ? { ...s, tagIds: session.tagIds, segments: session.segments } : s))
    return
  }
  await db.run('UPDATE sessions SET tag_ids = ?, segments = ? WHERE id = ?', [JSON.stringify(session.tagIds), JSON.stringify(session.segments), session.id])
}

export async function listBlocks(): Promise<BlockRecord[]> {
  if (!db) return readWeb<BlockRecord[]>(WEB_BLOCKS_KEY, []).sort((a, b) => b.startedAt - a.startedAt)
  const result = await db.query('SELECT * FROM blocks ORDER BY started_at DESC')
  return (result.values ?? []).map(row => ({
    id: row.id as string,
    startedAt: row.started_at as number,
    endedAt: row.ended_at as number,
    setup: parseJson(row.setup, { focusMin: 25, shortMin: 5, longMin: 15, sessions: 4 }),
    sessionIds: parseJson(row.session_ids, []),
    breaks: parseJson(row.breaks, []),
  }))
}

export async function saveBlock(block: BlockRecord): Promise<void> {
  if (!db) {
    const blocks = readWeb<BlockRecord[]>(WEB_BLOCKS_KEY, [])
    if (!blocks.some(b => b.id === block.id)) writeWeb(WEB_BLOCKS_KEY, [block, ...blocks])
    return
  }
  await db.run('INSERT OR IGNORE INTO blocks (id, started_at, ended_at, setup, session_ids, breaks) VALUES (?, ?, ?, ?, ?, ?)',
    [block.id, block.startedAt, block.endedAt, JSON.stringify(block.setup), JSON.stringify(block.sessionIds), JSON.stringify(block.breaks)])
}

/** Delete a block and its sessions; their focus comes off every total. */
export async function deleteBlock(blockId: string): Promise<void> {
  if (!db) {
    writeWeb(WEB_BLOCKS_KEY, readWeb<BlockRecord[]>(WEB_BLOCKS_KEY, []).filter(b => b.id !== blockId))
    writeWeb(WEB_SESSIONS_KEY, readWeb<SessionRecord[]>(WEB_SESSIONS_KEY, []).filter(s => s.blockId !== blockId))
    return
  }
  await db.executeSet([
    { statement: 'DELETE FROM sessions WHERE block_id = ?', values: [blockId] },
    { statement: 'DELETE FROM blocks WHERE id = ?', values: [blockId] },
  ])
}
