import { useCallback, useEffect, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE, type ActiveTimer, type Phase, type Settings, type UiState } from './domain/types'
import { AUTO_START_MS, addStopwatchLap, countdownElapsedMs, modeSwitchPrompt, pauseTakeover, takeoverAfterCompletion, type SwitchPrompt } from './domain/flow'
import { elapsedMs, finishTimer, isComplete, pauseTimer, phaseDurationMs, remainingMs, resumeTimer, settingsAfterCompletion, startTimer } from './domain/timer'
import { initializePersistence, loadActiveTimer, loadSettings, loadUiState, saveActiveTimer, saveSession, saveSettings, saveUiState } from './services/persistence'
import { cancelTimerNotification, scheduleTimerNotification } from './services/notifications'
import { formatStopwatch } from './ui/format'
import { ConfirmDialog } from './ui/parts'
import { PomodoroScreen } from './screens/PomodoroScreen'
import { StopwatchScreen } from './screens/StopwatchScreen'
import { TakeoverScreen } from './screens/TakeoverScreen'
import { Hub, HubPlaceholder } from './screens/Hub'
import { SettingsPanel } from './screens/SettingsPanel'

const resetBlock = (settings: Settings): Settings => ({ ...settings, completedFocusCount: 0, nextPhase: 'focus' as Phase })

export function App() {
  const [ready, setReady] = useState(false), [startupError, setStartupError] = useState<string | null>(null)
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS), [active, setActive] = useState<ActiveTimer | null>(null)
  const [ui, setUi] = useState<UiState>(DEFAULT_UI_STATE), [now, setNow] = useState(Date.now())
  const [switchPrompt, setSwitchPrompt] = useState<SwitchPrompt | null>(null)
  const completing = useRef(false), uiRef = useRef(ui)
  const { mode, takeover, laps } = ui

  /** Merge a UI change into state and persist it. */
  const updateUi = useCallback(async (patch: Partial<UiState>) => {
    const next = { ...uiRef.current, ...patch }
    uiRef.current = next; setUi(next)
    await saveUiState(next)
  }, [])

  const signalCompletion = useCallback(() => { if (settings.vibrate && 'vibrate' in navigator) navigator.vibrate([90, 45, 130]); if (settings.sound) try { const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (Ctx) { const c = new Ctx(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 620; g.gain.setValueAtTime(.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(.12, c.currentTime + .015); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .18); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + .2) } } catch { /* best effort */ } }, [settings.sound, settings.vibrate])

  const finishCompleted = useCallback(async (timer: ActiveTimer, at: number, currentSettings = settings) => {
    if (completing.current) return; completing.current = true
    try {
      const record = finishTimer(timer, at, true); if (record) await saveSession(record)
      const nextSettings = timer.mode === 'pomodoro' ? settingsAfterCompletion(currentSettings, timer.phase) : currentSettings
      const n = timer.phase === 'focus' ? Math.min(currentSettings.longBreakEvery, currentSettings.completedFocusCount + 1) : timer.phase === 'longBreak' ? currentSettings.longBreakEvery : currentSettings.completedFocusCount
      const nextTakeover = timer.mode === 'pomodoro' ? takeoverAfterCompletion(timer.phase, nextSettings, n, at) : null
      setSettingsState(nextSettings); setActive(null)
      await Promise.all([saveSettings(nextSettings), saveActiveTimer(null), updateUi({ takeover: nextTakeover }), cancelTimerNotification()])
      signalCompletion()
    } finally { completing.current = false }
  }, [settings, signalCompletion, updateUi])

  const startPhase = useCallback(async (phase: Phase, newBlock = false) => {
    const nextSettings = newBlock ? resetBlock(settings) : settings, timer = startTimer('pomodoro', phase, [], nextSettings, Date.now(), crypto.randomUUID())
    setSettingsState(nextSettings); setActive(timer)
    await Promise.all([saveSettings(nextSettings), saveActiveTimer(timer), updateUi({ mode: 'pomodoro', takeover: null }), scheduleTimerNotification(timer, Date.now(), settings.notifyWhenClosed)])
  }, [settings, updateUi])

  useEffect(() => { void (async () => {
    try {
      await initializePersistence()
      const [s, timer, storedUi] = await Promise.all([loadSettings(), loadActiveTimer(), loadUiState()])
      uiRef.current = storedUi; setUi(storedUi); setSettingsState(s); setActive(timer)
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
  useEffect(() => { if (active?.status === 'running' && isComplete(active, now)) void finishCompleted(active, now); if (takeover?.auto && !takeover.countdownPaused && countdownElapsedMs(takeover, now) >= AUTO_START_MS) void startPhase(takeover.kind === 'sessionOver' ? settings.nextPhase : 'focus') }, [active, finishCompleted, now, settings.nextPhase, startPhase, takeover])
  useEffect(() => { const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (!isActive && active?.mode === 'stopwatch' && active.status === 'running' && !settings.stopwatchKeepsRunning) { const timer = pauseTimer(active, Date.now()); setActive(timer); void saveActiveTimer(timer) } else if (isActive) setNow(Date.now()) }); return () => { void listener.then(h => h.remove()) } }, [active, settings.stopwatchKeepsRunning])
  useEffect(() => { if (!Capacitor.isNativePlatform()) return; const darkGround = takeover !== null && takeover.kind !== 'blockFinished' && !ui.hubOpen; void StatusBar.setOverlaysWebView({ overlay: true }); void StatusBar.setStyle({ style: darkGround ? Style.Light : Style.Dark }) }, [ui.hubOpen, takeover])
  useEffect(() => { let lock: { release: () => Promise<void> } | undefined; if (settings.keepScreenAwake && active?.status === 'running' && 'wakeLock' in navigator) void navigator.wakeLock.request('screen').then(value => { lock = value }).catch(() => undefined); return () => { void lock?.release() } }, [active?.status, settings.keepScreenAwake])

  const updateSettings = async (next: Settings) => { setSettingsState(next); await saveSettings(next) }
  const pauseActive = async () => { if (!active) return; const timer = pauseTimer(active, Date.now()); setActive(timer); await saveActiveTimer(timer); await cancelTimerNotification() }
  const resumeActive = async () => { if (!active) return; const timer = resumeTimer(active, Date.now()); setActive(timer); await saveActiveTimer(timer); if (timer.mode === 'pomodoro') await scheduleTimerNotification(timer, Date.now(), settings.notifyWhenClosed) }
  /** Stop whatever is live, keep what counts, and reset the block. */
  const endActive = async (patch: Partial<UiState> = {}) => {
    const record = active ? finishTimer(active, Date.now(), active.mode === 'stopwatch') : null
    if (record) await saveSession(record)
    const nextSettings = active?.mode === 'pomodoro' ? resetBlock(settings) : settings
    setSettingsState(nextSettings); setActive(null)
    await Promise.all([saveSettings(nextSettings), saveActiveTimer(null), updateUi(patch), cancelTimerNotification()])
  }
  const skipBreak = async () => { if (!active) return; const nextSettings = { ...settings, nextPhase: 'focus' as Phase }; setSettingsState(nextSettings); setActive(null); await Promise.all([saveSettings(nextSettings), saveActiveTimer(null), cancelTimerNotification()]) }
  const startStopwatch = async () => { const timer = startTimer('stopwatch', 'focus', [], settings, Date.now(), crypto.randomUUID()); setActive(timer); await saveActiveTimer(timer) }
  const addLap = async () => { if (!active || active.mode !== 'stopwatch') return; await updateUi({ laps: addStopwatchLap(laps, elapsedMs(active, Date.now()), crypto.randomUUID()) }) }
  const resetStopwatch = () => endActive({ laps: [] })
  const handleTakeoverStart = async () => { if (takeover) await startPhase(takeover.kind === 'sessionOver' ? settings.nextPhase : 'focus') }
  const handleTakeoverPause = async () => { if (!takeover) return; await updateUi({ takeover: takeover.countdownPaused ? { ...takeover, countdownPaused: false, countdownStartedAt: Date.now() } : pauseTakeover(takeover, Date.now()) }) }

  // 13D: switching modes asks only when something is live.
  const otherMode = mode === 'pomodoro' ? 'stopwatch' : 'pomodoro'
  const requestModeSwitch = async () => {
    const live = active?.mode === mode ? active : null
    if (!live) { await updateUi({ mode: otherMode, takeover: null }); return }
    const at = Date.now()
    setSwitchPrompt(live.mode === 'stopwatch'
      ? modeSwitchPrompt('stopwatch', { kind: 'stopwatch', elapsedMs: elapsedMs(live, at), laps: laps.length, display: formatStopwatch(elapsedMs(live, at)).main })
      : live.phase === 'focus'
        ? modeSwitchPrompt('pomodoro', { kind: 'focus', sessionNumber: Math.min(settings.longBreakEvery, settings.completedFocusCount + 1), focusedMs: elapsedMs(live, at) })
        : modeSwitchPrompt('pomodoro', { kind: 'break' }))
  }
  const confirmModeSwitch = async () => { setSwitchPrompt(null); await endActive({ mode: otherMode, takeover: null, laps: mode === 'stopwatch' ? [] : laps }) }

  const openHub = () => void updateUi({ hubOpen: true }), closeHub = () => void updateUi({ hubOpen: false })

  if (!ready) return <main className="loading">Pomi</main>
  if (startupError) return <main className="startup-error"><h1>Pomi needs a moment</h1><p>{startupError}</p><button onClick={() => location.reload()}>Try again</button></main>

  let screen
  if (takeover) screen = <TakeoverScreen state={takeover} settings={settings} now={now} onMode={() => void requestModeSwitch()} onHub={openHub} onStart={() => void handleTakeoverStart()} onSkip={() => void startPhase('focus')} onPause={() => void handleTakeoverPause()} onDone={() => void updateUi({ takeover: null })} onNewBlock={() => void startPhase('focus', true)}/>
  else if (mode === 'stopwatch') {
    const sw = active?.mode === 'stopwatch' ? active : null
    screen = <StopwatchScreen status={!sw ? 'zero' : sw.status === 'running' ? 'running' : 'stopped'} elapsed={sw ? elapsedMs(sw, now) : 0} laps={laps} onMode={() => void requestModeSwitch()} onHub={openHub} onStart={() => void startStopwatch()} onStop={() => void pauseActive()} onLap={() => void addLap()} onReset={() => void resetStopwatch()} onResume={() => void resumeActive()}/>
  } else {
    const pomo = active?.mode === 'pomodoro' ? active : null, phase = pomo ? pomo.phase : settings.nextPhase
    screen = <PomodoroScreen active={pomo} settings={settings} phase={phase} remaining={pomo ? remainingMs(pomo, now) ?? 0 : phaseDurationMs(phase, settings)} now={now} onMode={() => void requestModeSwitch()} onHub={openHub} onStart={() => void startPhase('focus')} onPause={() => void pauseActive()} onResume={() => void resumeActive()} onEnd={() => void endActive()} onSkipBreak={() => void skipBreak()}/>
  }

  return <>
    <div className="timer-layer" aria-hidden={ui.hubOpen || undefined} inert={ui.hubOpen || undefined}>{screen}</div>
    {switchPrompt && <ConfirmDialog title={switchPrompt.title} body={switchPrompt.body} keepLabel="Keep going" confirmLabel="End and switch" onKeep={() => setSwitchPrompt(null)} onConfirm={() => void confirmModeSwitch()}/>}
    {ui.hubOpen && <Hub tab={ui.hubTab} closeLabel={`Back to ${mode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}`} onTab={tab => void updateUi({ hubTab: tab })} onClose={closeHub}>
      {ui.hubTab === 'settings' ? <SettingsPanel settings={settings} onChange={next => void updateSettings(next)}/> : <HubPlaceholder title={ui.hubTab === 'statistics' ? 'Statistics' : 'History'}/>}
    </Hub>}
  </>
}
