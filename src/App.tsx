import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { DEFAULT_SETTINGS, DEFAULT_UI_STATE, setupFromSettings, type ActiveTimer, type BlockRecord, type BlockState, type Phase, type SessionRecord, type Settings, type Tag, type TakeoverState, type UiState } from './domain/types'
import { AUTO_START_MS, addStopwatchLap, blockAfterCompletion, countdownElapsedMs, modeSwitchPrompt, pauseTakeover, startBlock, takeoverAfterCompletion, type SwitchPrompt } from './domain/flow'
import { cutTags, dropTag, effectiveEnd, elapsedMs, finishTimer, isComplete, pauseTimer, phaseDurationMs, remainingMs, resumeTimer, startTimer } from './domain/timer'
import { blockRecordFrom, withBreak, withSession } from './domain/blocks'
import { calculateFocusMetrics } from './domain/metrics'
import { duplicateMessage, findDuplicate, liveTags, nextTagColor } from './domain/tags'
import { deleteBlock, initializePersistence, listBlocks, updateSessionTags, listSessions, listTags, loadActiveTimer, loadSettings, loadUiState, purgeTag, saveActiveTimer, saveBlock, saveSession, saveSettings, saveTag, saveUiState } from './services/persistence'
import { cancelTimerNotification, scheduleTimerNotification } from './services/notifications'
import { setKeepAwake, signalPhaseChange } from './services/alerts'
import { formatStopwatch } from './ui/format'
import { AlertDialog, ConfirmDialog, Toast } from './ui/parts'
import { TagHandle, TagInlineEdit, TagMenu, TagSheet, type TagPress } from './ui/tags'
import { ManageTags } from './screens/ManageTags'
import { PomodoroScreen } from './screens/PomodoroScreen'
import { StopwatchScreen } from './screens/StopwatchScreen'
import { TakeoverScreen } from './screens/TakeoverScreen'
import { Hub, HubPlaceholder } from './screens/Hub'
import { HistoryPanel } from './screens/HistoryPanel'
import { SettingsPanel } from './screens/SettingsPanel'

interface ToastState { message: string; action?: { label: string; onClick: () => void } }
interface DeleteAsk { ids: string[]; title: string; body: string; offer: boolean }
const UNDO_MS = 5_000

export function App() {
  const [ready, setReady] = useState(false), [startupError, setStartupError] = useState<string | null>(null)
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS), [active, setActive] = useState<ActiveTimer | null>(null)
  const [ui, setUi] = useState<UiState>(DEFAULT_UI_STATE), [now, setNow] = useState(Date.now())
  const [switchPrompt, setSwitchPrompt] = useState<SwitchPrompt | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [tags, setTags] = useState<Tag[]>([]), [sessions, setSessions] = useState<SessionRecord[]>([]), [blocks, setBlocks] = useState<BlockRecord[]>([])
  const [tagSheet, setTagSheet] = useState(false), [tagPress, setTagPress] = useState<TagPress | null>(null)
  const [historyFilter, setHistoryFilter] = useState<string[]>([])
  const [renaming, setRenaming] = useState<{ press: TagPress; error: string | null } | null>(null), [deleteAsk, setDeleteAsk] = useState<DeleteAsk | null>(null)
  const completing = useRef(false), uiRef = useRef(ui), toastTimer = useRef<number | undefined>(undefined), activeRef = useRef(active)
  const purgeTimers = useRef(new Map<string, number>())
  activeRef.current = active
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

  const setActiveTimer = useCallback(async (timer: ActiveTimer | null) => { activeRef.current = timer; setActive(timer); await saveActiveTimer(timer) }, [])

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
      if (timer.phase === 'focus' && !currentSettings.carryTags) patch = { ...patch, tagIds: [] }
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
    const timer = startTimer('pomodoro', phase, phase === 'focus' ? uiRef.current.tagIds : [], current.setup, at, crypto.randomUUID())
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
      // Deletes whose undo window closed while the app was away are made final.
      await Promise.all((await listTags()).filter(t => t.deletedAt).map(t => purgeTag(t.id)))
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
    const carry = active?.phase !== 'focus' || settings.carryTags
    setActive(null)
    await Promise.all([saveActiveTimer(null), updateUi({ ...(endsBlock ? { block: null } : {}), ...(carry ? {} : { tagIds: [] }), ...patch }), cancelTimerNotification()])
    await refreshData()
  }
  /** Skipping a break goes straight to the next session; skipping the long break starts a new block. */
  const skipAhead = async () => {
    // A break cut short still shows in the block's timeline.
    if (active?.mode === 'pomodoro' && active.phase !== 'focus') await updateUi({ block: await keepRun(active, Date.now(), false, block) })
    await startPhase('focus', uiRef.current.block?.nextPhase === 'longBreak')
  }
  const startStopwatch = async () => { await setActiveTimer(startTimer('stopwatch', 'focus', uiRef.current.tagIds, setupFromSettings(settings), Date.now(), crypto.randomUUID())) }
  const addLap = async () => { if (!active || active.mode !== 'stopwatch') return; await updateUi({ laps: addStopwatchLap(laps, elapsedMs(active, Date.now()), crypto.randomUUID()) }) }
  const resetStopwatch = () => endActive({ laps: [] })
  const handleTakeoverPause = async () => { if (!takeover) return; await updateUi({ takeover: takeover.countdownPaused ? { ...takeover, countdownPaused: false, countdownStartedAt: Date.now() } : pauseTakeover(takeover, Date.now()) }) }

  // Tags ------------------------------------------------------------------
  const visibleTags = useMemo(() => liveTags(tags), [tags])
  const tagTotals = useMemo(() => new Map(calculateFocusMetrics(sessions, tags).byTag.map(t => [t.id, t.focusedMs])), [sessions, tags])
  const onTags = ui.tagIds.map(id => visibleTags.find(t => t.id === id)).filter((t): t is Tag => Boolean(t))

  /** Turning a tag on or off cuts the running focus stretch. */
  const setTagIds = async (next: string[]) => {
    const timer = activeRef.current
    if (timer && timer.phase === 'focus') await setActiveTimer(cutTags(timer, next, Date.now()))
    await updateUi({ tagIds: next })
  }
  const toggleTag = (id: string) => void setTagIds(ui.tagIds.includes(id) ? ui.tagIds.filter(t => t !== id) : [...ui.tagIds, id])

  const createTag = async (name: string, color = nextTagColor(tags), turnOn = true): Promise<string | null> => {
    if (findDuplicate(tags, name)) return duplicateMessage(name)
    const tag: Tag = { id: crypto.randomUUID(), name: name.trim(), color, createdAt: Date.now(), deletedAt: null }
    await saveTag(tag); setTags(current => [...current, tag])
    if (turnOn) await setTagIds([...uiRef.current.tagIds, tag.id])
    return null
  }
  /** Rename or recolour. Never cuts the timeline. */
  const editTag = (id: string, patch: { name?: string; color?: string }): string | null => {
    const tag = tags.find(t => t.id === id)
    if (!tag) return null
    if (patch.name !== undefined && patch.name.trim() && findDuplicate(tags, patch.name, id)) return duplicateMessage(patch.name)
    const next = { ...tag, ...(patch.color ? { color: patch.color } : {}), ...(patch.name?.trim() ? { name: patch.name.trim() } : {}) }
    void saveTag(next); setTags(current => current.map(t => t.id === id ? next : t))
    return null
  }

  const deleteTags = async (ids: string[]) => {
    setDeleteAsk(null); setTagPress(null)
    const at = Date.now(), gone = tags.filter(t => ids.includes(t.id))
    const before = { timer: activeRef.current, tagIds: uiRef.current.tagIds }
    const wasOn = ids.some(id => before.tagIds.includes(id)), remaining = before.tagIds.filter(id => !ids.includes(id))
    for (const tag of gone) await saveTag({ ...tag, deletedAt: at })
    setTags(current => current.map(t => ids.includes(t.id) ? { ...t, deletedAt: at } : t))
    // The timer never stops: the tag leaves this session and the stretch is cut.
    let timer = before.timer
    for (const id of ids) if (timer) timer = dropTag(timer, id, at)
    if (timer !== before.timer) await setActiveTimer(timer)
    await updateUi({ tagIds: remaining })
    for (const tag of gone) purgeTimers.current.set(tag.id, window.setTimeout(() => { purgeTimers.current.delete(tag.id); void purgeTag(tag.id).then(refreshData) }, UNDO_MS))
    const live = Boolean(before.timer)
    const filterLeft = historyFilter.filter(id => !ids.includes(id)), filterCleared = historyFilter.length > 0 && filterLeft.length === 0
    if (filterLeft.length !== historyFilter.length) setHistoryFilter(filterLeft)
    const name = gone.length === 1 ? `Deleted “${gone[0].name}”` : `Deleted ${gone.length} tags`
    const message = wasOn && live ? `${name} · ${remaining.length ? 'removed from this session' : 'session continues untagged'}`
      : filterCleared ? 'Filter cleared — tag deleted' : name
    flash(message, { label: 'Undo', onClick: () => void undoDelete(gone, before) }, UNDO_MS)
  }
  /** Undo restores the tag, its colour, its history and its place in the current session. */
  const undoDelete = async (gone: Tag[], before: { timer: ActiveTimer | null; tagIds: string[] }) => {
    window.clearTimeout(toastTimer.current); setToast(null)
    for (const tag of gone) { window.clearTimeout(purgeTimers.current.get(tag.id)); purgeTimers.current.delete(tag.id); await saveTag({ ...tag, deletedAt: null }) }
    setTags(current => current.map(t => gone.some(g => g.id === t.id) ? { ...t, deletedAt: null } : t))
    const timer = activeRef.current
    if (timer && before.timer && timer.id === before.timer.id) await setActiveTimer({ ...timer, tagIds: before.timer.tagIds, segments: before.timer.segments })
    const current = uiRef.current.tagIds, restored = before.tagIds.filter(id => current.includes(id) || gone.some(g => g.id === id))
    await updateUi({ tagIds: [...restored, ...current.filter(id => !restored.includes(id))] })
  }
  const requestDelete = (ids: string[]) => {
    setTagPress(null)
    if (!ids.length) return
    if (!settings.confirmDelete) { void deleteTags(ids); return }
    const gone = visibleTags.filter(t => ids.includes(t.id)), logged = ids.reduce((sum, id) => sum + (tagTotals.get(id) ?? 0), 0)
    const minutes = Math.round(logged / 60_000), h = Math.floor(minutes / 60), m = minutes % 60, amount = h ? `${h} h${m ? ` ${m} m` : ''}` : `${m} m`
    setDeleteAsk(gone.length === 1
      ? { ids, offer: !ui.seenDeleteOffer, title: `Delete “${gone[0].name}”?`, body: logged ? `${amount} logged against it stays in your history as untagged time.` : 'It has no logged time yet.' }
      : { ids, offer: !ui.seenDeleteOffer, title: `Delete ${gone.length} tags?`, body: logged ? `${amount} logged against them stays in your history as untagged time.` : 'None of them have logged time yet.' })
    if (!ui.seenDeleteOffer) void updateUi({ seenDeleteOffer: true })
  }

  // History ---------------------------------------------------------------
  const saveRetag = async (changed: SessionRecord[]) => {
    for (const session of changed) await updateSessionTags(session)
    setSessions(current => current.map(s => changed.find(c => c.id === s.id) ?? s))
  }
  const retagStretch = (session: SessionRecord, index: number, tagIds: string[]) => {
    const segments = session.segments.map((seg, i) => i === index ? { ...seg, tagIds } : seg)
    void saveRetag([{ ...session, segments, tagIds: [...new Set(segments.flatMap(seg => seg.tagIds))] }])
  }
  const applyTags = (targets: SessionRecord[], tagIds: string[]) => void saveRetag(targets.map(s => ({
    ...s, tagIds, segments: [{ startedAt: s.startedAt, endedAt: s.endedAt, tagIds, focusedMs: s.focusedMs }],
  })))
  const removeBlock = async (blockId: string, dontAskAgain: boolean) => {
    await deleteBlock(blockId)
    if (dontAskAgain) await updateSettings({ ...settings, confirmDelete: false })
    await refreshData()
  }

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

  const handle = <TagHandle tags={onTags} onOpen={() => setTagSheet(true)}/>
  let screen
  if (takeover && block) screen = <TakeoverScreen state={takeover} block={block} now={now} onMode={() => void requestModeSwitch()} onHub={openHub} onStart={() => void continueFrom(takeover)} onSkip={() => void skipAhead()} onPause={() => void handleTakeoverPause()} onDone={() => void updateUi({ takeover: null, block: null })} onNewBlock={() => void startPhase('focus', true)}/>
  else if (mode === 'stopwatch') {
    const sw = active?.mode === 'stopwatch' ? active : null
    screen = <StopwatchScreen status={!sw ? 'zero' : sw.status === 'running' ? 'running' : 'stopped'} elapsed={sw ? elapsedMs(sw, now) : 0} laps={laps} onMode={() => void requestModeSwitch()} onHub={openHub} onStart={() => void startStopwatch()} onStop={() => void pauseActive()} onLap={() => void addLap()} onReset={() => void resetStopwatch()} onResume={() => void resumeActive()} handle={handle}/>
  } else {
    const pomo = active?.mode === 'pomodoro' ? active : null, setup = pomo && block ? block.setup : setupFromSettings(settings), phase = pomo ? pomo.phase : 'focus'
    screen = <PomodoroScreen active={pomo} setup={setup} completed={pomo ? block?.completedFocus ?? 0 : 0} phase={phase} remaining={pomo ? remainingMs(pomo, now) ?? 0 : phaseDurationMs(phase, setup)} now={now} onMode={() => void requestModeSwitch()} onHub={openHub} onStart={() => void startPhase('focus', true)} onPause={() => void pauseActive()} onResume={() => void resumeActive()} onEnd={() => void endActive()} onSkipBreak={() => void skipAhead()} handle={handle}/>
  }

  return <>
    <div className="timer-layer" aria-hidden={ui.hubOpen || undefined} inert={ui.hubOpen || undefined}>{screen}</div>
    {switchPrompt && <ConfirmDialog title={switchPrompt.title} body={switchPrompt.body} keepLabel="Keep going" confirmLabel="End and switch" onKeep={() => setSwitchPrompt(null)} onConfirm={() => void confirmModeSwitch()}/>}
    {ui.hubOpen && <Hub tab={ui.hubTab} closeLabel={`Back to ${mode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}`} onTab={tab => void updateUi({ hubTab: tab })} onClose={closeHub}>
      {ui.hubTab === 'settings'
        ? <SettingsPanel settings={settings} tagCount={visibleTags.length} onChange={next => void updateSettings(next)} onToast={message => flash(message)}
          renderManageTags={onBack => <ManageTags tags={visibleTags} totals={tagTotals} nextColor={nextTagColor(tags)} onBack={onBack} onDelete={requestDelete}
            onSave={draft => {
              if (draft.id) return editTag(draft.id, draft)
              const taken = findDuplicate(tags, draft.name)
              if (taken) return duplicateMessage(draft.name)
              void createTag(draft.name, draft.color, false).then(() => flash(`Added “${draft.name.trim()}”`))
              return null
            }}/>}/>
        : ui.hubTab === 'history'
          ? <HistoryPanel blocks={blocks} sessions={sessions} tags={visibleTags} totals={tagTotals} filter={historyFilter} confirmDelete={settings.confirmDelete} now={now}
            onFilter={setHistoryFilter} onRetag={retagStretch} onApply={applyTags} onDeleteBlock={(id, dontAsk) => void removeBlock(id, dontAsk)}/>
          : <HubPlaceholder title="Statistics"/>}
    </Hub>}
    {tagSheet && !ui.hubOpen && <TagSheet tags={visibleTags} activeIds={ui.tagIds} totals={tagTotals} onToggle={toggleTag} onClose={() => setTagSheet(false)}
      onCreate={name => void createTag(name)} onLongPress={setTagPress}/>}
    {tagPress && <TagMenu press={tagPress} onClose={() => setTagPress(null)}
      onEdit={() => { setRenaming({ press: tagPress, error: null }); setTagPress(null) }} onDelete={() => requestDelete([tagPress.tag.id])}/>}
    {renaming && <TagInlineEdit press={renaming.press} error={renaming.error} onCommit={name => {
      const error = editTag(renaming.press.tag.id, { name })
      setRenaming(error ? { ...renaming, error } : null)
    }}/>}
    {deleteAsk && <AlertDialog title={deleteAsk.title} body={deleteAsk.body} cta="Delete" onCancel={() => setDeleteAsk(null)} onConfirm={() => void deleteTags(deleteAsk.ids)}>
      {deleteAsk.offer && settings.confirmDelete && <div className="dont-ask">
        <button onClick={() => { void updateSettings({ ...settings, confirmDelete: false }); flash('Delete confirmations off — change it in Settings') }}><span className="box"/>Don't ask me again</button>
        <p>This offer appears once. After that you can only change it in Settings.</p>
      </div>}
    </AlertDialog>}
    {toast && <Toast message={toast.message} action={toast.action} raised={!ui.hubOpen}/>}
  </>
}
