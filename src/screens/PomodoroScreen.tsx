import type { ActiveTimer, Phase, Settings } from '../domain/types'
import { blockMinutesLeft, blockTotalMinutes } from '../domain/flow'
import { compactDuration, formatClock, pad2, pausedFor } from '../ui/format'
import { Actions, Header, Ring, Segments } from '../ui/parts'

export function PomodoroScreen({ active, settings, phase, remaining, now, onMode, onHub, onStart, onPause, onResume, onEnd, onSkipBreak }: {
  active: ActiveTimer | null; settings: Settings; phase: Phase; remaining: number; now: number
  onMode: () => void; onHub: () => void; onStart: () => void; onPause: () => void; onResume: () => void; onEnd: () => void; onSkipBreak: () => void
}) {
  const paused = active?.status === 'paused', short = phase === 'shortBreak', long = phase === 'longBreak'
  const progress = active?.durationMs ? remaining / active.durationMs : 1
  const sessionNumber = long ? settings.longBreakEvery : Math.min(settings.longBreakEvery, settings.completedFocusCount + 1)
  const completed = long ? settings.longBreakEvery : settings.completedFocusCount
  const label = !active ? 'New block' : short ? 'Short break' : long ? 'Long break' : `Session ${pad2(sessionNumber)}${paused ? ' · Paused' : ''}`
  const helper = !active ? `${settings.longBreakEvery} sessions · ${settings.focusMinutes} min each · ${compactDuration(blockTotalMinutes(settings))} total`
    : paused ? `Paused for ${pausedFor(active, now)}`
      : long ? `Block complete · ${settings.longBreakMinutes} min earned`
        : short ? `Session ${pad2(settings.completedFocusCount + 1)} next · ${compactDuration(blockMinutesLeft(settings, phase, completed, remaining))} left in this block`
          : `${compactDuration(blockMinutesLeft(settings, phase, completed, remaining))} left in this block`
  return <main className={`screen pomodoro-screen ${paused ? 'paused-screen' : ''} ${short ? 'short-break' : ''} ${long ? 'long-break' : ''}`}>
    <Header label={label} mode="pomodoro" onMode={onMode} onHub={onHub}/>
    <section className="instrument">
      <Ring display={formatClock(remaining)} label={paused ? 'Paused' : short ? 'Stand up' : long ? 'Get away from it' : 'Deep work'} progress={progress} phase={phase} paused={paused} ready={!active}/>
      <div className="segment-group"><Segments count={settings.longBreakEvery} completed={completed} currentProgress={active?.phase === 'focus' ? (1 - progress) * 100 : undefined} variant={paused ? 'paused' : short || long ? 'teal' : 'paper'} ready={!active}/><span>{helper}</span></div>
    </section>
    <Actions>{!active
      ? <button className="primary" onClick={onStart}>Start session</button>
      : active.status === 'running'
        ? <><button className="secondary" onClick={short ? onSkipBreak : onEnd}>{short ? 'Skip break' : 'End'}</button><button className="primary wide" onClick={onPause}>Pause</button></>
        : <><button className="secondary" onClick={onEnd}>End</button><button className="resume wide" onClick={onResume}>Resume</button></>}</Actions>
  </main>
}
