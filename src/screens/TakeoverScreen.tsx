import type { CSSProperties } from 'react'
import { AUTO_START_MS, countdownElapsedMs } from '../domain/flow'
import type { Settings, TakeoverState } from '../domain/types'
import { pad2 } from '../ui/format'
import { CheckIcon, UpArrowIcon } from '../ui/icons'
import { Actions, Header, Segments } from '../ui/parts'

export interface TakeoverHandlers { onMode: () => void; onHub: () => void; onStart: () => void; onSkip: () => void; onPause: () => void; onDone: () => void; onNewBlock: () => void }

export function TakeoverScreen({ state, settings, now, onMode, onHub, onStart, onSkip, onPause, onDone, onNewBlock }: { state: TakeoverState; settings: Settings; now: number } & TakeoverHandlers) {
  if (state.kind === 'blockFinished') {
    const focusedMinutes = settings.focusMinutes * settings.longBreakEvery
    return <main className="screen block-finished"><Header label="Block complete" mode="pomodoro" onMode={onMode} onHub={onHub}/><section className="block-summary">
      <strong className="block-total">{Math.floor(focusedMinutes / 60)}h{focusedMinutes % 60 || ''}</strong>
      <div className="block-line"><span>of deep work across {settings.longBreakEvery} sessions</span><Segments count={settings.longBreakEvery} completed={settings.longBreakEvery}/></div>
      <div className="summary-card"><div><span>Sessions completed</span><strong>{settings.longBreakEvery} of {settings.longBreakEvery}</strong></div><div><span>Breaks taken</span><b>{Math.max(0, settings.longBreakEvery - 1)} short · 1 long</b></div><div><span>Started</span><b>{new Date(state.completedAt - (focusedMinutes + settings.longBreakMinutes) * 60_000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</b></div></div>
    </section><Actions><button className="secondary" onClick={onDone}>Done</button><button className="primary wide" onClick={onNewBlock}>Start another block</button></Actions></main>
  }
  const work = state.kind === 'sessionOver', elapsed = countdownElapsedMs(state, now), remaining = Math.max(0, AUTO_START_MS - elapsed), nextSession = state.sessionNumber + 1
  const breakLabel = settings.nextPhase === 'longBreak' ? `Long break · ${settings.longBreakMinutes} min` : `Short break · ${settings.shortBreakMinutes} min`
  const segments = <Segments count={settings.longBreakEvery} completed={state.sessionNumber} variant={work ? 'takeover-work' : 'takeover-rest'}/>
  return <main className={`screen takeover-screen takeover-${work ? 'work' : 'rest'}`}><Header label={work ? `Session ${pad2(state.sessionNumber)} done` : 'Break over'} mode="pomodoro" takeover onHub={onHub}/>
    {state.auto
      ? <section className="auto-takeover"><h1>{work ? <>{settings.focusMinutes} minutes<br/>of deep work</> : 'Break over'}</h1><div className="countdown-ring" style={{ '--degrees': `${(1 - elapsed / AUTO_START_MS) * 360}deg` } as CSSProperties}><div><strong>0:{pad2(Math.ceil(remaining / 1000))}</strong><span>{work ? `${settings.nextPhase === 'longBreak' ? 'Long break' : 'Short break'} starts` : `Session ${pad2(state.phase === 'longBreak' ? 1 : nextSession)} starts`}</span></div></div>{segments}</section>
      : <section className="manual-takeover"><div className="takeover-result"><div className="result-icon">{work ? <CheckIcon/> : <UpArrowIcon/>}</div><h1>{work ? <>{settings.focusMinutes} minutes<br/>of deep work</> : 'Back to it'}</h1></div><div className="takeover-rule"/><div className="up-next"><span>Up next</span><strong>{work ? breakLabel : `Session ${pad2(nextSession)} · ${settings.focusMinutes} min`}</strong></div>{segments}</section>}
    <Actions>{state.auto
      ? <><button className="secondary takeover-button" onClick={onStart}>Start now</button><button className="primary takeover-button" onClick={onPause}>{state.countdownPaused ? 'Resume' : 'Pause'}</button></>
      : work
        ? <><button className="secondary takeover-button" onClick={onSkip}>Skip ahead</button><button className="primary takeover-button" onClick={onStart}>Start break</button></>
        : <button className="primary takeover-button" onClick={onStart}>Start session {pad2(nextSession)}</button>}</Actions>
  </main>
}
