import { useCallback, useEffect, useMemo, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { DEFAULT_SETTINGS, type ActiveTimer, type Mode, type SessionRecord, type Settings, type Tag } from './domain/types'
import { elapsedMs, finishTimer, isComplete, pauseTimer, remainingMs, resumeTimer, settingsAfterCompletion, startTimer } from './domain/timer'
import { calculateFocusMetrics } from './domain/metrics'
import { addTag, initializePersistence, listSessions, listTags, loadActiveTimer, loadSettings, saveActiveTimer, saveSession, saveSettings } from './services/persistence'
import { cancelTimerNotification, scheduleTimerNotification } from './services/notifications'

type Tab = 'timer' | 'metrics'

const phaseName = { focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' }
const formatClock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
const formatDuration = (ms: number) => {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.round((ms % 3_600_000) / 60_000)
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

export function App() {
  const [ready, setReady] = useState(false)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('timer')
  const [mode, setMode] = useState<Mode>('pomodoro')
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS)
  const [active, setActive] = useState<ActiveTimer | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [now, setNow] = useState(Date.now())
  const [showSettings, setShowSettings] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [newTag, setNewTag] = useState('')

  const refreshData = useCallback(async () => {
    setTags(await listTags())
    setSessions(await listSessions())
  }, [])

  const complete = useCallback(async (timer: ActiveTimer, at: number) => {
    const record = finishTimer(timer, at, true)
    if (record) await saveSession(record)
    if (timer.mode === 'pomodoro') {
      const next = settingsAfterCompletion(settings, timer.phase)
      setSettingsState(next)
      await saveSettings(next)
    }
    setActive(null)
    await saveActiveTimer(null)
    await cancelTimerNotification()
    await refreshData()
  }, [refreshData, settings])

  const reconcile = useCallback(async (timer = active, at = Date.now()) => {
    if (timer && timer.status === 'running' && isComplete(timer, at)) await complete(timer, at)
    setNow(at)
  }, [active, complete])

  useEffect(() => {
    void (async () => {
      try {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        await initializePersistence()
        const [loadedSettings, loadedTimer] = await Promise.all([loadSettings(), loadActiveTimer()])
        setSettingsState(loadedSettings)
        setActive(loadedTimer)
        await refreshData()
        if (loadedTimer && loadedTimer.status === 'running' && isComplete(loadedTimer, Date.now())) {
          const record = finishTimer(loadedTimer, Date.now(), true)
          if (record) await saveSession(record)
          const next = loadedTimer.mode === 'pomodoro' ? settingsAfterCompletion(loadedSettings, loadedTimer.phase) : loadedSettings
          await saveSettings(next)
          await saveActiveTimer(null)
          setSettingsState(next)
          setActive(null)
          await refreshData()
        }
      } catch (error) {
        console.error('Pomi failed to initialize', error)
        setStartupError('Your saved data could not be opened. Pomi left it untouched so it can be recovered.')
      } finally {
        setReady(true)
      }
    })()
  }, [refreshData])

  useEffect(() => {
    const interval = window.setInterval(() => void reconcile(), 250)
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void reconcile() })
    return () => { window.clearInterval(interval); void listener.then((handle) => handle.remove()) }
  }, [reconcile])

  const displayMs = active
    ? active.mode === 'pomodoro' ? remainingMs(active, now) ?? 0 : elapsedMs(active, now)
    : mode === 'pomodoro' ? ({ focus: settings.focusMinutes, shortBreak: settings.shortBreakMinutes, longBreak: settings.longBreakMinutes }[settings.nextPhase] * 60_000) : 0

  const start = async () => {
    const timer = startTimer(mode, settings.nextPhase, selectedTags, settings, Date.now(), crypto.randomUUID())
    setActive(timer)
    await saveActiveTimer(timer)
    await scheduleTimerNotification(timer, Date.now())
  }
  const pause = async () => {
    if (!active) return
    const timer = pauseTimer(active, Date.now())
    setActive(timer)
    await saveActiveTimer(timer)
    await cancelTimerNotification()
  }
  const resume = async () => {
    if (!active) return
    const timer = resumeTimer(active, Date.now())
    setActive(timer)
    await saveActiveTimer(timer)
    await scheduleTimerNotification(timer, Date.now())
  }
  const stop = async () => {
    if (!active) return
    const record = finishTimer(active, Date.now(), false)
    if (record) await saveSession(record)
    setActive(null)
    await saveActiveTimer(null)
    await cancelTimerNotification()
    await refreshData()
  }
  const updateSettings = async (next: Settings) => {
    setSettingsState(next)
    await saveSettings(next)
  }
  const createTag = async () => {
    const name = newTag.trim()
    if (!name) return
    const tag = { id: crypto.randomUUID(), name, createdAt: Date.now() }
    await addTag(tag)
    setTags((current) => [...current, tag])
    setSelectedTags((current) => [...current, tag.id])
    setNewTag('')
  }

  const metrics = useMemo(() => calculateFocusMetrics(sessions, tags), [sessions, tags])

  if (!ready) return <main className="loading">Pomi</main>
  if (startupError) return <main className="startup-error"><h1>Pomi needs a moment</h1><p>{startupError}</p><button onClick={() => window.location.reload()}>Try again</button></main>

  return <main className="app-shell">
    <header>
      <div className="brand"><span className="brand-mark">P</span><span>Pomi</span></div>
      <button className="icon-button" aria-label="Settings" onClick={() => setShowSettings(true)}>⚙</button>
    </header>

    {tab === 'timer' ? <section className="timer-screen">
      <div className="segmented" aria-label="Timer mode">
        {(['pomodoro', 'stopwatch'] as const).map((item) => <button key={item} disabled={Boolean(active)} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>{item === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}</button>)}
      </div>
      <div className={`timer-orb ${active?.status === 'running' ? 'is-running' : ''}`}>
        <span className="eyebrow">{mode === 'stopwatch' ? 'Open focus' : phaseName[active?.phase ?? settings.nextPhase]}</span>
        <strong>{formatClock(displayMs)}</strong>
        <span className="status">{active ? active.status : 'Ready when you are'}</span>
      </div>
      <button className="tag-picker" disabled={Boolean(active)} onClick={() => setShowTags(true)}>
        <span>{selectedTags.length ? tags.filter((tag) => selectedTags.includes(tag.id)).map((tag) => tag.name).join(', ') : 'Add a focus tag'}</span><span>＋</span>
      </button>
      <div className="controls">
        {!active && <button className="primary" onClick={() => void start()}>Start</button>}
        {active?.status === 'running' && <button className="primary" onClick={() => void pause()}>Pause</button>}
        {active?.status === 'paused' && <button className="primary" onClick={() => void resume()}>Resume</button>}
        {active && <button className="secondary" onClick={() => void stop()}>Stop & save</button>}
      </div>
      {mode === 'pomodoro' && !active && <p className="cycle">{settings.completedFocusCount} of {settings.longBreakEvery} focus sessions before a long break</p>}
    </section> : <section className="metrics-screen">
      <div className="section-heading"><span className="eyebrow">All time</span><h1>Your focus</h1></div>
      <article className="total-card"><span>Focused time</span><strong>{formatDuration(metrics.overallFocusedMs)}</strong><small>{sessions.length} saved {sessions.length === 1 ? 'session' : 'sessions'}</small></article>
      <h2>By tag</h2>
      <div className="metric-list">
        {metrics.byTag.length ? metrics.byTag.map((tag) => <div className="metric-row" key={tag.id}><span className="tag-dot"/><span>{tag.name}</span><strong>{formatDuration(tag.focusedMs)}</strong></div>) : <p className="empty">Tag a session to see where your focus goes.</p>}
      </div>
      <h2>Recent</h2>
      <div className="history-list">
        {sessions.slice(0, 8).map((session) => <div className="history-row" key={session.id}><div><strong>{session.mode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}</strong><small>{new Date(session.endedAt).toLocaleDateString()}</small></div><span>{formatDuration(session.focusedMs)}</span></div>)}
      </div>
    </section>}

    <nav><button className={tab === 'timer' ? 'active' : ''} onClick={() => setTab('timer')}><span>◷</span>Timer</button><button className={tab === 'metrics' ? 'active' : ''} onClick={() => setTab('metrics')}><span>▥</span>Metrics</button></nav>

    {showTags && <div className="sheet-backdrop" onMouseDown={() => setShowTags(false)}><section className="sheet" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><h2>Focus tags</h2><button onClick={() => setShowTags(false)}>Done</button></div><div className="tag-list">{tags.map((tag) => <button key={tag.id} className={selectedTags.includes(tag.id) ? 'selected' : ''} onClick={() => setSelectedTags((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])}><span>{tag.name}</span><span>{selectedTags.includes(tag.id) ? '✓' : ''}</span></button>)}</div><div className="new-tag"><input value={newTag} maxLength={30} placeholder="New tag" onChange={(event) => setNewTag(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createTag() }}/><button onClick={() => void createTag()}>Add</button></div></section></div>}

    {showSettings && <div className="sheet-backdrop" onMouseDown={() => setShowSettings(false)}><section className="sheet" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><h2>Settings</h2><button onClick={() => setShowSettings(false)}>Done</button></div>{([['focusMinutes', 'Focus', 1, 180], ['shortBreakMinutes', 'Short break', 1, 60], ['longBreakMinutes', 'Long break', 1, 120], ['longBreakEvery', 'Long break every', 1, 12]] as const).map(([key, label, min, max]) => <label className="setting-row" key={key}><span>{label}<small>{key === 'longBreakEvery' ? 'sessions' : 'minutes'}</small></span><input type="number" min={min} max={max} value={settings[key]} onChange={(event) => { const value = Math.min(max, Math.max(min, Number(event.target.value) || min)); void updateSettings({ ...settings, [key]: value }) }}/></label>)}<p className="settings-note">Active timers keep the duration they started with. Everything stays on this device.</p></section></div>}
  </main>
}
