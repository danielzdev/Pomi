import type { ReactNode } from 'react'
import type { ActiveTimer, BlockSetup, Phase } from '../domain/types'
import { blockMinutesLeft, blockTotalMinutes } from '../domain/flow'
import { compactDuration, formatClock, pad2, pausedFor } from '../ui/format'
import { Actions, Header, Ring, Segments } from '../ui/parts'

/** `setup` is the running block's setup, or the settings' on Ready; `completed` counts finished sessions. */
export function PomodoroScreen({ shortLabels = false, active, setup, completed: done, phase, remaining, now, onMode, onHub, onStart, onPause, onResume, onEnd, onSkipBreak, handle }: {
  shortLabels?: boolean; active: ActiveTimer | null; setup: BlockSetup; completed: number; phase: Phase; remaining: number; now: number
  onMode: () => void; onHub: () => void; onStart: () => void; onPause: () => void; onResume: () => void; onEnd: () => void; onSkipBreak: () => void; handle?: ReactNode
}) {
  const paused = active?.status === 'paused', short = phase === 'shortBreak', long = phase === 'longBreak'
  const progress = active?.durationMs ? remaining / active.durationMs : 1
  const completed = long ? setup.sessions : done
  const sessionNumber = long ? setup.sessions : Math.min(setup.sessions, done + 1)
  // At large text sizes the two-part eyebrow shortens to one word.
  const label = !active ? 'New block' : short ? 'Short break' : long ? 'Long break'
    : paused ? (shortLabels ? 'Paused' : `Session ${pad2(sessionNumber)} · Paused`) : `Session ${pad2(sessionNumber)}`
  const left = compactDuration(blockMinutesLeft(setup, phase, completed, remaining))
  const helper = !active ? `${setup.sessions} ${setup.sessions === 1 ? 'session' : 'sessions'} · ${setup.focusMin} min each · ${compactDuration(blockTotalMinutes(setup))} total`
    : paused ? `Paused for ${pausedFor(active, now)}`
      : long ? `Block complete · ${setup.longMin} min earned`
        : short ? `Session ${pad2(completed + 1)} next · ${left} left in this block`
          : `${left} left in this block`
  return <main className={`screen pomodoro-screen ${paused ? 'paused-screen' : ''} ${short ? 'short-break' : ''} ${long ? 'long-break' : ''}`}>
    <Header label={label} mode="pomodoro" onMode={onMode} onHub={onHub}/>
    <section className="instrument">
      <Ring display={formatClock(remaining)} label={paused ? 'Paused' : short ? 'Stand up' : long ? 'Get away from it' : 'Deep work'} progress={progress} phase={phase} paused={paused} ready={!active}/>
      <div className="segment-group"><Segments count={setup.sessions} completed={completed} currentProgress={active?.phase === 'focus' ? (1 - progress) * 100 : undefined} variant={paused ? 'paused' : short || long ? 'teal' : 'paper'} ready={!active}/><span>{helper}</span></div>
    </section>
    {handle && <div className="handle-row">{handle}</div>}
    <Actions>{!active
      ? <button className="primary" onClick={onStart}>Start session</button>
      : active.status === 'running'
        ? <><button className="secondary" onClick={short ? onSkipBreak : onEnd}>{short ? 'Skip break' : 'End'}</button><button className="primary wide" onClick={onPause}>Pause</button></>
        : <><button className="secondary" onClick={onEnd}>End</button><button className="resume wide" onClick={onResume}>Resume</button></>}</Actions>
  </main>
}
