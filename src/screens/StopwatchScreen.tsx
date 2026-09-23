import type { ReactNode } from 'react'
import type { StopwatchLap } from '../domain/types'
import { formatStopwatch, pad2 } from '../ui/format'
import { Actions, Header } from '../ui/parts'

export function StopwatchScreen({ status, elapsed, laps, onMode, onHub, onStart, onStop, onLap, onReset, onResume, handle }: {
  status: 'zero' | 'running' | 'stopped'; elapsed: number; laps: StopwatchLap[]
  onMode: () => void; onHub: () => void; onStart: () => void; onStop: () => void; onLap: () => void; onReset: () => void; onResume: () => void; handle?: ReactNode
}) {
  const running = status === 'running', stopped = status === 'stopped', sw = formatStopwatch(elapsed)
  const durations = laps.map(l => l.durationMs), fastest = durations.length >= 2 ? Math.min(...durations) : -1, slowest = durations.length >= 2 ? Math.max(...durations) : -1
  return <main className="screen stopwatch-screen">
    <Header label={`Stopwatch${running ? ' · Running' : stopped ? ' · Stopped' : ''}`} mode="stopwatch" onMode={onMode} onHub={onHub}/>
    <section className={`stopwatch-content ${laps.length ? 'has-laps' : ''}`}>
      <div className="stopwatch-digits"><span>{sw.main}</span><small className={running ? 'running' : stopped ? 'stopped' : ''}>{sw.fraction}</small></div>
      {status === 'zero' && <div className="stopwatch-ready">Ready</div>}
      {laps.length > 0 && <div className="lap-table"><div className="lap-head"><span>Lap</span><span>Split</span></div>{laps.map((lap, i) => {
        const split = formatStopwatch(lap.durationMs)
        return <div className={`lap-row ${lap.durationMs === fastest ? 'fastest' : lap.durationMs === slowest ? 'slowest' : ''}`} key={lap.id}><span>{pad2(laps.length - i)}{lap.durationMs === fastest && <em>Fastest</em>}{lap.durationMs === slowest && <em>Slowest</em>}</span><strong>{split.main}{split.fraction}</strong></div>
      })}</div>}
    </section>
    {handle && <div className="handle-row">{handle}</div>}
    <Actions>{status === 'zero'
      ? <><button className="disabled-action" disabled>Lap</button><button className="primary wide" onClick={onStart}>Start</button></>
      : running
        ? <><button className="secondary" onClick={onStop}>Stop</button><button className="primary wide" onClick={onLap}>Lap</button></>
        : <><button className="secondary" onClick={onReset}>Reset</button><button className="resume wide" onClick={onResume}>Resume</button></>}</Actions>
  </main>
}
