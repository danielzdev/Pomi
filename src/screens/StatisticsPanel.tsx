import { useMemo, useState } from 'react'
import { dayKey } from '../domain/blocks'
import { aggregate, buildDays, cellState, currentStreak, eachDay, firstDay, mostUsedSetup, periodRange, startOfDay, streakRuns, tagShares, type CellState, type Period, type TagShare } from '../domain/stats'
import type { BlockRecord, SessionRecord, Tag } from '../domain/types'
import { SubScreen } from '../ui/parts'

const MIN = 60_000
const ACCENT = '#C9604A'
const NNBSP = '\u202F'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 12 345 with narrow no-break spaces. */
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP)
const hm = (ms: number) => {
  const m = Math.round(ms / MIN), h = Math.floor(m / 60), mm = m % 60
  return h ? (mm ? `${fmt(h)} h ${String(mm).padStart(2, '0')} m` : `${fmt(h)} h`) : `${mm} m`
}
const short = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`
const pct = (a: number, b: number) => b ? Math.round(a / b * 100) : 0
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`

interface Sheet { label: string; value: string; sub: string; color: string; desc: string; rows: [string, string][] }
type Page = 'main' | 'streak' | 'tags'

export function StatisticsPanel({ sessions, blocks, tags, thresholdMin, now, onThreshold, onStartSession }: {
  sessions: SessionRecord[]; blocks: BlockRecord[]; tags: Tag[]; thresholdMin: number; now: number
  onThreshold: (deltaMin: number) => void; onStartSession: () => void
}) {
  const [period, setPeriod] = useState<Period>('W')
  const [offsets, setOffsets] = useState<Record<Period, number>>({ D: 0, W: 0, M: 0, Y: 0 })
  const [mode, setMode] = useState<'sessions' | 'blocks'>('sessions')
  const [page, setPage] = useState<Page>('main'), [sheet, setSheet] = useState<Sheet | null>(null)

  const today = startOfDay(now), dayOfToday = dayKey(now)
  const days = useMemo(() => buildDays(sessions, blocks), [sessions, blocks])
  const first = firstDay(days, today)
  const empty = !sessions.some(s => s.phase === 'focus' && s.focusedMs > 0)
  const off = offsets[period], range = periodRange(period, off, today)
  const a = aggregate(range, days, today, first, thresholdMin)
  const canPrev = !empty && range.start > first, canNext = off < 0
  const setOff = (value: number) => setOffsets({ ...offsets, [period]: value })

  const y = range.start.getFullYear(), cy = today.getFullYear()
  const periodTitle = { D: off ? 'Day' : 'Today', W: off ? 'Week' : 'This week', M: off ? 'Month' : 'This month', Y: off ? 'Year' : 'This year' }[period]
  const periodLabel = period === 'D' ? `${WEEKDAYS[range.start.getDay()]}, ${short(range.start)}`
    : period === 'W' ? (range.start.getMonth() === range.end.getMonth() ? `${short(range.start)} – ${range.end.getDate()}` : `${short(range.start)} – ${short(range.end)}`)
      : period === 'M' ? MONTHS_FULL[range.start.getMonth()] + (y !== cy ? ` ${y}` : '') : String(y)

  // Headline numbers shrink when they get long.
  const m = Math.round(a.focusMs / MIN), h = Math.floor(m / 60), mm = m % 60
  const focus = m >= 6000 ? { a: fmt(h), au: 'h' } : m < 60 ? { a: String(mm), au: 'm' } : { a: String(h), au: 'h', b: String(mm).padStart(2, '0') }
  const sessionsText = fmt(a.sessions)
  const bigSize = Math.max(focus.a.length, sessionsText.length) > 4 ? 30 : 38
  const blocksText = empty ? 'none yet' : period === 'D' ? `${plural(a.blocks, 'block')} · ${fmt(a.solo)} solo` : `${fmt(a.blocks)} blocks`

  const streak = currentStreak(days, today, thresholdMin)
  const runs = streakRuns(days, first, today, thresholdMin)
  const todayMs = days.get(dayOfToday)?.focusMs ?? 0
  const streakText = plural(streak, 'day')
  const streakNote = off === 0 || period !== 'D'
    ? (todayMs >= thresholdMin * MIN ? `today counted at ${hm(thresholdMin * MIN)}` : `${hm(thresholdMin * MIN - todayMs)} to go today`)
    : (a.focusMs >= thresholdMin * MIN ? `counted at ${hm(a.focusMs)}` : `fell short at ${hm(a.focusMs)}`)
  const best = runs[0]

  const cell = (d: Date) => cellState(d, days, today, first, thresholdMin)
  const dates = eachDay(range.start, range.end)
  let bestMonth: { counted: number; name: string } | null = null
  const yearBars = period === 'Y' ? MONTHS.map((name, mo) => {
    const md = { start: new Date(y, mo, 1), end: new Date(y, mo + 1, 0) }, ma = aggregate(md, days, today, first, thresholdMin)
    const pick = () => { setPeriod('M'); setOffsets({ ...offsets, M: (y * 12 + mo) - (cy * 12 + today.getMonth()) }) }
    if (!ma.elapsed) return { name: name[0], pick, height: 0, empty: true, current: false }
    if (!bestMonth || ma.counted > bestMonth.counted) bestMonth = { counted: ma.counted, name }
    return { name: name[0], pick, height: pct(ma.counted, ma.elapsed), empty: false, current: y === cy && mo === today.getMonth() }
  }) : []
  const captionMain = empty ? `A day counts once you reach ${hm(thresholdMin * MIN)} of focus.` : `${fmt(a.counted)} of ${fmt(a.elapsed)} days counted`
  const captionRest = empty || period === 'W' ? '' : period === 'M' ? `· longest run ${plural(a.longestRun, 'day')}` : bestMonth ? `· best month ${(bestMonth as { name: string }).name}` : ''

  const early = a.earlyCount, quitAvg = early ? Math.round(a.earlyFocusMs / early / MIN) : 0
  const setup = mostUsedSetup(blocks, range)
  const stats: Sheet[] = mode === 'sessions' ? [
    { label: 'Completion', value: `${pct(a.finished, a.sessions)}%`, sub: `${fmt(a.finished)} of ${fmt(a.sessions)} finished`, color: 'var(--ink)', desc: 'Share of sessions that ran to the bell — the length their block was set to when it started. Sessions you ended early count against it.', rows: [['Finished', fmt(a.finished)], ['Ended early', fmt(early)], ['Best day', a.best ? `${WEEKDAYS[a.best.day.getDay()]}, ${short(a.best.day)}` : '—']] },
    { label: 'Ended early', value: fmt(early), sub: `${pct(early, a.sessions)}% of sessions`, color: ACCENT, desc: 'Sessions stopped before the timer finished. A quiet number to watch, not a score.', rows: [['Of sessions', `${pct(early, a.sessions)}%`], ['Avg stop point', `${quitAvg} m`], ['Time lost', hm(a.earlyShortMs)]] },
    { label: 'Avg length', value: `${a.sessions ? Math.round(a.focusMs / a.sessions / MIN) : 0} m`, sub: 'per session, early stops in', color: 'var(--ink)', desc: 'Average focused minutes per session, early stops included. Each session is judged against the length its block was set to.', rows: [['Most used length', setup ? `${setup.focusMin} m` : '—'], ['Sessions', fmt(a.sessions)], ['Focus time', hm(a.focusMs)]] },
    { label: 'Quit at', value: `${quitAvg} m`, sub: `avg of ${plural(early, 'early stop')}`, color: 'var(--ink)', desc: 'How far in you were, on average, when you stopped early.', rows: [['Ended early', fmt(early)], ['Of sessions', `${pct(early, a.sessions)}%`]] },
  ] : [
    { label: 'Blocks finished', value: `${pct(a.blocksFinished, a.blocks)}%`, sub: `${fmt(a.blocksFinished)} of ${fmt(a.blocks)} finished`, color: 'var(--ink)', desc: 'Share of blocks you saw through to the long break, whatever length each was set to.', rows: [['Finished', fmt(a.blocksFinished)], ['Broken', fmt(a.blocks - a.blocksFinished)], ['Blocks started', fmt(a.blocks)]] },
    { label: 'Broken', value: fmt(a.blocks - a.blocksFinished), sub: `${pct(a.blocks - a.blocksFinished, a.blocks)}% of blocks`, color: ACCENT, desc: 'Blocks ended before their last session.', rows: [['Of blocks', `${pct(a.blocks - a.blocksFinished, a.blocks)}%`], ['Sessions kept', fmt(a.finished)]] },
    { label: 'Per block', value: a.blocks ? (a.blockSessions / a.blocks).toFixed(1) : '0', sub: 'sessions, avg', color: 'var(--ink)', desc: 'Average sessions logged per block. Sessions outside a block are counted as solo.', rows: [['Sessions', fmt(a.sessions)], ['Blocks', fmt(a.blocks)], ['Solo sessions', fmt(a.solo)]] },
    { label: 'Block length', value: hm(a.blocks ? a.blockFocusMs / a.blocks : 0), sub: 'avg focus per block', color: 'var(--ink)', desc: 'Focused time per block, breaks not included.', rows: [['Focus time', hm(a.blockFocusMs)], ['Blocks', fmt(a.blocks)], ['Most used setup', setup ? `${setup.focusMin} m × ${setup.sessions}` : '—']] },
  ]

  const { rows: tagRows, untagged } = tagShares(sessions, tags, range)
  const topMs = tagRows[0]?.focusMs || untagged.focusMs || 1
  const tagSheet = (row: TagShare): Sheet => {
    const share = pct(row.focusMs, a.focusMs)
    return {
      label: row.tag?.name ?? 'Untagged', value: hm(row.focusMs), sub: `${share}% of focus time`, color: row.tag?.color ?? 'var(--ink-3)',
      desc: row.tag ? 'Focus time logged under this tag. Sessions can carry several tags, so tag totals may exceed focus time.' : 'Focus time with no tag on it — stretches left untagged, plus time whose tag was later deleted.',
      rows: [['Sessions', fmt(row.sessions)], ['Avg per counted day', hm(a.counted ? row.focusMs / a.counted : 0)], ['Share of sessions', `${pct(row.sessions, a.sessions)}%`]],
    }
  }
  const TagBar = ({ row, big = false }: { row: TagShare; big?: boolean }) => <button className={`stat-tag ${big ? 'big' : ''}`} onClick={() => setSheet(tagSheet(row))}>
    <span className="stat-tag-top"><span className={row.tag ? '' : 'untagged'}>{row.tag?.name ?? 'Untagged'}</span><span><small>{pct(row.focusMs, a.focusMs)}%</small><b>{hm(row.focusMs)}</b></span></span>
    <span className="stat-bar"><i style={{ width: `${Math.round(row.focusMs / topMs * 100)}%`, background: row.tag ? ACCENT : 'var(--line-strong)' }}/></span>
  </button>
  const allRows = [...tagRows, ...(untagged.focusMs > 0 ? [untagged] : [])]
  const allTagsText = `All ${tagRows.length} ${tagRows.length === 1 ? 'tag' : 'tags'}`

  return <>
    <div className="stats-toolbar"><span/>
      <div className="stat-segments" role="tablist" aria-label="Period">{(['D', 'W', 'M', 'Y'] as Period[]).map(p =>
        <button key={p} role="tab" aria-selected={p === period} aria-label={{ D: 'Day', W: 'Week', M: 'Month', Y: 'Year' }[p]} className={p === period ? 'active' : ''} onClick={() => setPeriod(p)}>{p}</button>)}
      </div>
    </div>

    <div className="stats-hero">
      <div className="stats-hero-head"><span>{periodTitle}</span>
        <span className="stats-nav">
          <button aria-label="Earlier" disabled={!canPrev} onClick={() => canPrev && setOff(off - 1)}><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
          <span>{periodLabel}</span>
          <button aria-label="Later" disabled={!canNext} onClick={() => canNext && setOff(off + 1)}><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
        </span>
      </div>
      <div className="stats-hero-numbers">
        <div><span className="stats-caption">Focus time</span>
          <span className="stats-big" style={{ fontSize: bigSize }}>{focus.a}<small>{focus.au}</small>{'b' in focus && <><i/>{focus.b}<small>m</small></>}</span></div>
        <div><span className="stats-caption">Sessions</span>
          <span className="stats-big" style={{ fontSize: bigSize }}>{sessionsText}<em>{blocksText}</em></span></div>
      </div>
      {period === 'D' && <div className="stats-hero-streak"><span>Streak</span><span><strong>{streakText}</strong> · {streakNote}</span></div>}
    </div>

    {period !== 'D' && <div className="stats-card streak-card" role="button" tabIndex={0} aria-label="Streak details" onClick={() => setPage('streak')} onKeyDown={e => { if (e.key === 'Enter') setPage('streak') }}>
      <span className="streak-head"><span><h2>Streak</h2><Chevron/></span><span><strong>{streakText}</strong> · best {best ? plural(best.length, 'day') : '—'}</span></span>
      {period === 'W' && <><span className="grid-labels week">{'MTWTFSS'.split('').map((d, i) => <i key={i}>{d}</i>)}</span>
        <span className="cells week">{dates.map(d => <Cell key={d.getTime()} state={cell(d)}/>)}</span></>}
      {period === 'M' && <><span className="grid-labels month">{'MTWTFSS'.split('').map((d, i) => <i key={i}>{d}</i>)}</span>
        <span className="cells month">{Array.from({ length: (range.start.getDay() + 6) % 7 }, (_, i) => <i key={`b${i}`}/>)}{dates.map(d => <Cell key={d.getTime()} state={cell(d)}/>)}</span></>}
      {period === 'Y' && <><span className="year-bars">{yearBars.map((bar, i) => <button key={i} aria-label={`Open ${MONTHS_FULL[i]}`} className={`year-bar ${bar.empty ? 'empty' : ''}`} onClick={e => { e.stopPropagation(); bar.pick() }}><i style={{ height: `${bar.height}%` }}/></button>)}</span>
        <span className="year-labels">{yearBars.map((bar, i) => <i key={i} className={bar.current ? 'current' : bar.empty ? 'empty' : ''}>{bar.name}</i>)}</span></>}
      <span className="streak-caption">{captionMain} {captionRest}</span>
    </div>}

    {empty
      ? <div className="stats-empty">
        <div><h2>Nothing to count yet</h2><p>Finish one session and this fills in: completion, time per tag, and your streak.</p></div>
        <div className="ghost-grid"><i/><i/></div>
        <button onClick={onStartSession}>Start a session</button>
      </div>
      : <>
        <section className="stats-section">
          <div className="stats-section-head"><h2>Reliability</h2>
            <div className="stat-segments small"><button className={mode === 'sessions' ? 'active' : ''} onClick={() => setMode('sessions')}>Sessions</button><button className={mode === 'blocks' ? 'active' : ''} onClick={() => setMode('blocks')}>Blocks</button></div>
          </div>
          <div className="stat-grid">{stats.map(s => <button key={s.label} className="stat-tile" onClick={() => setSheet(s)}>
            <span>{s.label}</span><b>{s.value}</b><small>{s.sub}</small></button>)}</div>
        </section>
        <div className="stats-card tags-card">
          <div className="stats-section-head"><h2>Tags</h2><span>of focus time</span></div>
          {(period === 'D' || period === 'W') && tagRows.slice(0, 3).map(row => <TagBar key={row.tag!.id} row={row}/>)}
          <button className="all-tags" onClick={() => setPage('tags')}><span>{allTagsText}</span><Chevron/></button>
        </div>
      </>}

    {page === 'streak' && <SubScreen title="Streak" onBack={() => setPage('main')} actions={<span className="sub-meta">{periodLabel}</span>}>
      <div className="sub-scroll stats-sub">
        <div className="stats-hero small"><span className="stats-caption">Current streak</span><span className="stats-big" style={{ fontSize: 38 }}>{streakText}</span><span className="stats-caption note">{streakNote}</span></div>
        <div className="stats-card rows">{[
          ['Longest streak', best ? `${short(best.start)} – ${short(best.end)}` : '—', best ? plural(best.length, 'day') : '—'],
          ['Days counted', `${pct(a.counted, a.elapsed)}% of ${periodLabel}`, `${fmt(a.counted)} of ${fmt(a.elapsed)}`],
          ['Best day', a.best ? `${WEEKDAYS[a.best.day.getDay()]}, ${short(a.best.day)}` : '—', a.best ? hm(a.best.focusMs) : '—'],
          ['Longest run', `within ${periodLabel}`, plural(a.longestRun, 'day')],
        ].map(([k, sub, v]) => <div key={k} className="stat-row"><span><b>{k}</b><small>{sub}</small></span><strong>{v}</strong></div>)}</div>
        {runs.length > 0 && <div className="stats-card runs"><h2>Longest runs</h2>{runs.slice(0, 4).map(run => <div key={run.start.getTime()} className="run-row">
          <span><b>{plural(run.length, 'day')}</b><small>{short(run.start)} – {short(run.end)}</small></span>
          <span className="stat-bar"><i style={{ width: `${Math.max(6, Math.round(run.length / runs[0].length * 70))}%`, background: ACCENT }}/></span>
        </div>)}</div>}
        <div className="stats-card threshold">
          <span><b>Counted at</b><small>A day counts once focus time reaches this.</small></span>
          <span className="threshold-stepper">
            <button aria-label="Lower threshold" disabled={thresholdMin <= 30} onClick={() => onThreshold(-30)}>−</button>
            <strong>{hm(thresholdMin * MIN)}</strong>
            <button aria-label="Raise threshold" disabled={thresholdMin >= 480} onClick={() => onThreshold(30)}>+</button>
          </span>
        </div>
      </div>
    </SubScreen>}

    {page === 'tags' && <SubScreen title="Tags" onBack={() => setPage('main')} actions={<span className="sub-meta">{periodLabel}</span>}>
      <div className="sub-scroll stats-sub tags-list">
        <div className="stats-section-head"><h2>{allTagsText}</h2><span>Tags can overlap</span></div>
        {allRows.map(row => <TagBar key={row.tag?.id ?? 'untagged'} row={row} big/>)}
        {allRows.length === 0 && <p className="sheet-empty">No focus time in this period.</p>}
      </div>
    </SubScreen>}

    {sheet && <div className="sheet-layer">
      <div className="sheet-scrim dark" onClick={() => setSheet(null)}/>
      <div className="delete-sheet stat-sheet" role="dialog" aria-label={sheet.label}>
        <span className="grabber static"/>
        <div className="stat-sheet-head"><h3 className="sheet-label">{sheet.label}</h3><span>{periodLabel}</span></div>
        <div className="stat-sheet-value"><b style={{ color: sheet.color }}>{sheet.value}</b><span>{sheet.sub}</span></div>
        <p>{sheet.desc}</p>
        <div>{sheet.rows.map(([k, v]) => <div key={k} className="stat-sheet-row"><span>{k}</span><strong>{v}</strong></div>)}</div>
      </div>
    </div>}
  </>
}

function Cell({ state }: { state: CellState }) { return <i className={`cell ${state}`}/> }
function Chevron() { return <svg className="chev" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg> }
