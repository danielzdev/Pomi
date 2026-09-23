import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE, setupFromSettings, type ActiveTimer, type BlockRecord, type BlockState, type Phase, type SessionRecord, type Settings, type Tag, type TakeoverState, type UiState } from './domain/types'
import { AUTO_START_MS, addStopwatchLap, blockAfterCompletion, countdownElapsedMs, modeSwitchPrompt, pauseTakeover, startBlock, takeoverAfterCompletion, type SwitchPrompt } from './domain/flow'
import { effectiveEnd, elapsedMs, finishTimer, isComplete, pauseTimer, phaseDurationMs, remainingMs, resumeTimer, startTimer } from './domain/timer'
import { blockRecordFrom, withBreak, withSession } from './domain/blocks'
import { initializePersistence, listBlocks, listSessions, listTags, loadActiveTimer, loadSettings, loadUiState, saveActiveTimer, saveBlock, saveSession, saveSettings, saveUiState } from './services/persistence'
import { cancelTimerNotification, scheduleTimerNotification } from './services/notifications'
import { setKeepAwake, signalPhaseChange } from './services/alerts'
import { formatStopwatch } from './ui/format'
import { ConfirmDialog, Toast } from './ui/parts'
import { PomodoroScreen } from './screens/PomodoroScreen'
import { StopwatchScreen } from './screens/StopwatchScreen'
import { TakeoverScreen } from './screens/TakeoverScreen'
import { Hub, HubPlaceholder } from './screens/Hub'
import { SettingsPanel } from './screens/SettingsPanel'

interface ToastState { message: string; action?: { label: string; onClick: () => void } }

export function App() {
  const [ready, setReady] = useState(false), [startupError, setStartupError] = useState<string | null>(null)
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS), [active, setActive] = useState<ActiveTimer | null>(null)
  const [ui, setUi] = useState<UiState>(DEFAULT_UI_STATE), [now, setNow] = useState(Date.now())
  const [switchPrompt, setSwitchPrompt] = useState<SwitchPrompt | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [tags, setTags] = useState<Tag[]>([]), [sessions, setSessions] = useState<SessionRecord[]>([]), [blocks, setBlocks] = useState<BlockRecord[]>([])
  const completing = useRef(false), uiRef = useRef(ui), toastTimer = useRef<number | undefined>(undefined)
  const { mode, takeover, laps, block } = ui

  /** Merge a UI change into state and persist it. */
  const updateUi = useCallback(async (patch: Partial<UiState>) => {
    const next = { ...uiRef.current, ...patch }
    uiRef.current = next; setUi(next)
    await saveUiState(next)
  }, [])

  const refreshData = useCallback(async () => {
    const [t, s, b] = await Promise.all([listTags(), listSessions(), listBlocks()])
    setTags(t); setSessions(s); setBlocks(b)
  }, [])

  /** Keep a finished run and note it on its block. */
  const keepRun = useCallback(async (timer: ActiveTimer, at: number, completed: boolean, current: BlockState | null): Promise<BlockState | null> => {
    const record = finishTimer(timer, at, completed, timer.mode === 'pomodoro' ? current?.id ?? null : null)
    if (record) await saveSession(timer.mode === 'stopwatch' ? { ...record, laps: uiRef.current.laps } : record)
    if (timer.mode !== 'pomodoro' || !current) return current
    if (record) return withSession(current, record.id)
    return timer.phase === 'focus' ? current : withBreak(current, { kind: timer.phase === 'longBreak' ? 'long' : 'short', startedAt: timer.startedAt, endedAt: effectiveEnd(timer, at) })
  }, [])

  /** A block ends: keep its record if it holds any saved session. */
  const closeBlock = useCallback(async (current: BlockState | null, at: number) => {
    const record = current ? blockRecordFrom(current, at) : null
    if (record) await saveBlock(record)
  }, [])

  const flash = useCallback((message: string, action?: ToastState['action'], ms = 2400) => {
    window.clearTimeout(toastTimer.current)
    setToast({ message, action })
    toastTimer.current = window.setTimeout(() => setToast(null), ms)
  }, [])

  const finishCompleted = useCallback(async (timer: ActiveTimer, at: number, currentSettings = settings) => {
    if (completing.current) return; completing.current = true
    try {
      let patch: Partial<UiState> = {}
      if (timer.mode === 'pomodoro') {
        const end = effectiveEnd(timer, at)
        const current = await keepRun(timer, at, true, uiRef.current.block ?? startBlock(currentSettings, timer.startedAt, crypto.randomUUID()))
        const nextBlock = blockAfterCompletion(current!, timer.phase)
        if (timer.phase === 'longBreak') await closeBlock(nextBlock, end)
        patch = { block: nextBlock, takeover: takeoverAfterCompletion(timer.phase, nextBlock, currentSettings, end) }
      } else await keepRun(timer, at, true, null)
      setActive(null)
      await Promise.all([saveActiveTimer(null), updateUi(patch), cancelTimerNotification()])
      await refreshData()
      signalPhaseChange(currentSettings)
    } finally { completing.current = false }
  }, [closeBlock, keepRun, refreshData, settings, updateUi])

  /** Start a Pomodoro phase in the current block, or in a fresh block built from the settings. */
  const startPhase = useCallback(async (phase: Phase, newBlock = false) => {
    const at = Date.now()
    if (newBlock) await closeBlock(uiRef.current.block, at)
    const current: BlockState = !newBlock && uiRef.current.block ? uiRef.current.block : startBlock(settings, at, crypto.randomUUID())
    const timer = startTimer('pomodoro', phase, [], current.setup, at, crypto.randomUUID())
    setActive(timer)
    await Promise.all([saveActiveTimer(timer), updateUi({ mode: 'pomodoro', takeover: null, block: { ...current, nextPhase: phase } }), scheduleTimerNotification(timer, at, settings.notifyWhenClosed)])
  }, [closeBlock, settings, updateUi])

  /** What follows a takeover: the block's next phase, or a new block after the long break. */
  const continueFrom = useCallback((state: TakeoverState) => {
    if (state.phase === 'longBreak') return startPhase('focus', true)
    return startPhase(state.kind === 'sessionOver' ? uiRef.current.block?.nextPhase ?? 'focus' : 'focus')
  }, [startPhase])

  useEffect(() => { void (async () => {
    try {
      await initializePersistence()
      const [s, timer, storedUi] = await Promise.all([loadSettings(), loadActiveTimer(), loadUiState(), refreshData()])
      // A Pomodoro saved before blocks existed gets a block built from the current settings.
      const restored = timer?.mode === 'pomodoro' && !storedUi.block ? { ...storedUi, block: startBlock(s, timer.startedAt, crypto.randomUUID()) }
        : storedUi.block ? { ...storedUi, block: { ...storedUi.block, sessionIds: storedUi.block.sessionIds ?? [], breaks: storedUi.block.breaks ?? [] } } : storedUi
      uiRef.current = restored; setUi(restored); setSettingsState(s); setActive(timer)
      if (timer?.status === 'running' && isComplete(timer, Date.now())) await finishCompleted(timer, Date.now(), s)
    } catch (error) { console.error('Pomi failed to initialize', error); setStartupError('Your saved data could not be opened. Pomi left it untouched so it can be recovered.') } finally { setReady(true) }
  })() }, [])

  useEffect(() => {
    if (active?.mode === 'stopwatch' && active.status === 'running' && !ui.hubOpen) {
      let frame = 0
      const tick = () => { setNow(Date.now()); frame = requestAnimationFrame(tick) }
      frame = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(frame)
    }
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [active?.mode, active?.status, ui.hubOpen])
  useEffect(() => {
    if (active?.status === 'running' && isComplete(active, now)) void finishCompleted(active, now)
    if (takeover?.auto && !takeover.countdownPaused && countdownElapsedMs(takeover, now) >= AUTO_START_MS) void continueFrom(takeover)
  }, [active, continueFrom, finishCompleted, now, takeover])
  useEffect(() => { const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (!isActive && active?.mode === 'stopwatch' && active.status === 'running' && !settings.stopwatchKeepsRunning) { const timer = pauseTimer(active, Date.now()); setActive(timer); void saveActiveTimer(timer) } else if (isActive) setNow(Date.now()) }); return () => { void listener.then(h => h.remove()) } }, [active, settings.stopwatchKeepsRunning])
  useEffect(() => { if (!Capacitor.isNativePlatform()) return; const darkGround = takeover !== null && takeover.kind !== 'blockFinished' && !ui.hubOpen; void StatusBar.setOverlaysWebView({ overlay: true }); void StatusBar.setStyle({ style: darkGround ? Style.Light : Style.Dark }) }, [ui.hubOpen, takeover])
  useEffect(() => { void setKeepAwake(settings.keepScreenAwake && active?.status === 'running') }, [active?.status, settings.keepScreenAwake])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const updateSettings = async (next: Settings) => { setSettingsState(next); await saveSettings(next) }
  const pauseActive = async () => { if (!active) return; const timer = pauseTimer(active, Date.now()); setActive(timer); await saveActiveTimer(timer); await cancelTimerNotification() }
  const resumeActive = async () => { if (!active) return; const timer = resumeTimer(active, Date.now()); setActive(timer); await saveActiveTimer(timer); if (timer.mode === 'pomodoro') await scheduleTimerNotification(timer, Date.now(), settings.notifyWhenClosed) }
  /** Stop whatever is live and keep what counts. Ending a Pomodoro ends its block. */
  const endActive = async (patch: Partial<UiState> = {}) => {
    const at = Date.now(), endsBlock = active?.mode === 'pomodoro'
    const current = active ? await keepRun(active, at, active.mode === 'stopwatch', endsBlock ? block : null) : null
    if (endsBlock) await closeBlock(current, at)
    setActive(null)
    await Promise.all([saveActiveTimer(null), updateUi({ ...(endsBlock ? { block: null } : {}), ...patch }), cancelTimerNotification()])
    await refreshData()
  }
  /** Skipping a break goes straight to the next session; skipping the long break starts a new block. */
  const skipAhead = async () => {
    // A break cut short still shows in the block's timeline.
    if (active?.mode === 'pomodoro' && active.phase !== 'focus') await updateUi({ block: await keepRun(active, Date.now(), false, block) })
    await startPhase('focus', uiRef.current.block?.nextPhase === 'longBreak')
  }
  const startStopwatch = async () => { const timer = startTimer('stopwatch', 'focus', [], setupFromSettings(settings), Date.now(), crypto.randomUUID()); setActive(timer); await saveActiveTimer(timer) }
  const addLap = async () => { if (!active || active.mode !== 'stopwatch') return; await updateUi({ laps: addStopwatchLap(laps, elapsedMs(active, Date.now()), crypto.randomUUID()) }) }
  const resetStopwatch = () => endActive({ laps: [] })
  const handleTakeoverPause = async () => { if (!takeover) return; await updateUi({ takeover: takeover.countdownPaused ? { ...takeover, countdownPaused: false, countdownStartedAt: Date.now() } : pauseTakeover(takeover, Date.now()) }) }

  // 13D: switching modes asks only when something is live.
  const otherMode = mode === 'pomodoro' ? 'stopwatch' : 'pomodoro'
  const requestModeSwitch = async () => {
    const live = active?.mode === mode ? active : null
    if (!live) { await updateUi({ mode: otherMode, takeover: null, block: null }); return }
    const at = Date.now()
    setSwitchPrompt(live.mode === 'stopwatch'
      ? modeSwitchPrompt('stopwatch', { kind: 'stopwatch', elapsedMs: elapsedMs(live, at), laps: laps.length, display: formatStopwatch(elapsedMs(live, at)).main })
      : live.phase === 'focus'
        ? modeSwitchPrompt('pomodoro', { kind: 'focus', sessionNumber: (block?.completedFocus ?? 0) + 1, focusedMs: elapsedMs(live, at) })
        : modeSwitchPrompt('pomodoro', { kind: 'break' }))
  }
  const confirmModeSwitch = async () => { setSwitchPrompt(null); await endActive({ mode: otherMode, takeover: null, laps: mode === 'stopwatch' ? [] : laps }) }

  const openHub = () => void updateUi({ hubOpen: true }), closeHub = () => void updateUi({ hubOpen: false })

  if (!ready) return <main className="loading">Pomi</main>
  if (startupError) return <main className="startup-error"><h1>Pomi needs a moment</h1><p>{startupError}</p><button onClick={() => location.reload()}>Try again</button></main>

  let screen
  if (takeover && block) screen = <TakeoverScreen state={takeover} block={block} now={now} onMode={() => void requestModeSwitch()} onHub={openHub} onStart={() => void continueFrom(takeover)} onSkip={() => void skipAhead()} onPause={() => void handleTakeoverPause()} onDone={() => void updateUi({ takeover: null, block: null })} onNewBlock={() => void startPhase('focus', true)}/>
  else if (mode === 'stopwatch') {
    const sw = active?.mode === 'stopwatch' ? active : null
    screen = <StopwatchScreen status={!sw ? 'zero' : sw.status === 'running' ? 'running' : 'stopped'} elapsed={sw ? elapsedMs(sw, now) : 0} laps={laps} onMode={() => void requestModeSwitch()} onHub={openHub} onStart={() => void startStopwatch()} onStop={() => void pauseActive()} onLap={() => void addLap()} onReset={() => void resetStopwatch()} onResume={() => void resumeActive()}/>
  } else {
    const pomo = active?.mode === 'pomodoro' ? active : null, setup = pomo && block ? block.setup : setupFromSettings(settings), phase = pomo ? pomo.phase : 'focus'
    screen = <PomodoroScreen active={pomo} setup={setup} completed={pomo ? block?.completedFocus ?? 0 : 0} phase={phase} remaining={pomo ? remainingMs(pomo, now) ?? 0 : phaseDurationMs(phase, setup)} now={now} onMode={() => void requestModeSwitch()} onHub={openHub} onStart={() => void startPhase('focus', true)} onPause={() => void pauseActive()} onResume={() => void resumeActive()} onEnd={() => void endActive()} onSkipBreak={() => void skipAhead()}/>
  }

  return <>
    <div className="timer-layer" aria-hidden={ui.hubOpen || undefined} inert={ui.hubOpen || undefined}>{screen}</div>
    {switchPrompt && <ConfirmDialog title={switchPrompt.title} body={switchPrompt.body} keepLabel="Keep going" confirmLabel="End and switch" onKeep={() => setSwitchPrompt(null)} onConfirm={() => void confirmModeSwitch()}/>}
    {ui.hubOpen && <Hub tab={ui.hubTab} closeLabel={`Back to ${mode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}`} onTab={tab => void updateUi({ hubTab: tab })} onClose={closeHub}>
      {ui.hubTab === 'settings'
        ? <SettingsPanel settings={settings} tagCount={tags.filter(t => !t.deletedAt).length} onChange={next => void updateSettings(next)} onToast={message => flash(message)}/>
        : <HubPlaceholder title={ui.hubTab === 'statistics' ? 'Statistics' : 'History'}/>}
    </Hub>}
    {toast && <Toast message={toast.message} action={toast.action}/>}
  </>
}
