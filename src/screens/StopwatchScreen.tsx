import type { ReactNode } from 'react'
import type { StopwatchLap } from '../domain/types'
import { formatLap, formatStopwatch, lapNumber } from '../ui/format'
import { Actions, Header } from '../ui/parts'

/** From this many laps, Fastest and Slowest pin above a list that scrolls on its own. */
const PIN_AT = 8

export function StopwatchScreen({ status, elapsed, laps, capped, shortLabels, onMode, onHub, onStart, onStop, onLap, onReset, onResume, handle }: {
  status: 'zero' | 'running' | 'stopped'; elapsed: number; laps: StopwatchLap[]
  /** Stopped at the 24 h cap: Resume is off. */
  capped: boolean; shortLabels: boolean
  onMode: () => void; onHub: () => void; onStart: () => void; onStop: () => void; onLap: () => void; onReset: () => void; onResume: () => void; handle?: ReactNode
}) {
  const running = status === 'running', stopped = status === 'stopped', sw = formatStopwatch(elapsed)
  const durations = laps.map(l => l.durationMs), fastest = durations.length >= 2 ? Math.min(...durations) : -1, slowest = durations.length >= 2 ? Math.max(...durations) : -1
  const pinned = laps.length >= PIN_AT
  const indexOf = (value: number) => laps.length - laps.findIndex(l => l.durationMs === value)
  const label = shortLabels ? (running ? 'Running' : stopped ? 'Stopped' : 'Stopwatch') : `Stopwatch${running ? ' · Running' : stopped ? ' · Stopped' : ''}`
  return <main className="screen stopwatch-screen">
    <Header label={label} mode="stopwatch" onMode={onMode} onHub={onHub}/>
    <section className={`stopwatch-content ${laps.length ? 'has-laps' : ''}`}>
      <div className={`stopwatch-digits step-${sw.step}`}><span>{sw.main}</span>{sw.fraction && <small className={running ? 'running' : stopped ? 'stopped' : ''}>{sw.fraction}</small>}</div>
      {status === 'zero' && <div className="stopwatch-ready">Ready</div>}
      {pinned && <div className="lap-pins">
        <div className="lap-pin fastest"><span>Fastest · {lapNumber(indexOf(fastest), laps.length)}</span><b>{formatLap(fastest)}</b></div>
        <div className="lap-pin slowest"><span>Slowest · {lapNumber(indexOf(slowest), laps.length)}</span><b>{formatLap(slowest)}</b></div>
      </div>}
      {laps.length > 0 && <div className="lap-table">
        <div className="lap-head"><span>{pinned ? `Lap · ${lapNumber(laps.length, laps.length)}` : 'Lap'}</span><span>Split</span></div>
        <div className="lap-scroll">{laps.map((lap, i) => {
          const tag = pinned ? '' : lap.durationMs === fastest ? 'fastest' : lap.durationMs === slowest ? 'slowest' : ''
          return <div className={`lap-row ${tag}`} key={lap.id}>
            <span>{lapNumber(laps.length - i, laps.length)}{tag === 'fastest' && <em>Fastest</em>}{tag === 'slowest' && <em>Slowest</em>}</span>
            <strong>{formatLap(lap.durationMs)}</strong>
          </div>
        })}</div>
      </div>}
    </section>
    {handle && <div className="handle-row">{handle}</div>}
    <Actions>{status === 'zero'
      ? <><button className="disabled-action" disabled>Lap</button><button className="primary wide" onClick={onStart}>Start</button></>
      : running
        ? <><button className="secondary" onClick={onStop}>Stop</button><button className="primary wide" onClick={onLap}>Lap</button></>
        : <><button className="secondary" onClick={onReset}>Reset</button>{capped
          ? <button className="disabled-action wide" disabled>Resume</button>
          : <button className="resume wide" onClick={onResume}>Resume</button>}</>}</Actions>
  </main>
}
