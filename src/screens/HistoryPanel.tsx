import { useState } from 'react'
import { dayKey, groupByDay, judgeBlock } from '../domain/blocks'
import type { BlockRecord, Segment, SessionRecord, Tag } from '../domain/types'
import { CheckIcon } from '../ui/icons'
import { TagSheet } from '../ui/tags'

const MIN = 60_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n: number) => String(n).padStart(2, '0')

/** "2 h 05 m", "2 h", "40 m" */
export const hm = (ms: number) => {
  const m = Math.round(ms / MIN), h = Math.floor(m / 60), mm = m % 60
  return h ? (mm ? `${h} h ${pad(mm)} m` : `${h} h`) : `${mm} m`
}

/** "9:41", with "+1" when it falls on the day after the block started. */
const clock = (at: number, blockStart: number) => {
  const d = new Date(at)
  return `${d.getHours()}:${pad(d.getMinutes())}${dayKey(at) !== dayKey(blockStart) ? ' +1' : ''}`
}

const dayLabel = (key: string, now: number) => {
  const [y, m, d] = key.split('-').map(Number), date = new Date(y, m - 1, d)
  if (key === dayKey(now)) return 'Today'
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  if (key === dayKey(yesterday.getTime())) return 'Yesterday'
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`
}

type Retag = { sessionId: string; index: number; number: number }

export function HistoryPanel({ blocks, sessions, tags, totals, filter, confirmDelete, now, onFilter, onRetag, onApply, onDeleteBlock }: {
  blocks: BlockRecord[]; sessions: SessionRecord[]; tags: Tag[]; totals: Map<string, number>; filter: string[]; confirmDelete: boolean; now: number
  onFilter: (ids: string[]) => void
  /** Replace one stretch's tags. */
  onRetag: (session: SessionRecord, index: number, tagIds: string[]) => void
  /** Copy one stretch's tags across a whole session or block, collapsing it to one stretch each. */
  onApply: (targets: SessionRecord[], tagIds: string[]) => void
  onDeleteBlock: (blockId: string, dontAskAgain: boolean) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [openSessions, setOpenSessions] = useState<Set<string>>(new Set())
  const [sheet, setSheet] = useState<'filter' | null>(null)
  const [retag, setRetag] = useState<Retag | null>(null), [applied, setApplied] = useState<'session' | 'block' | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; focusedMs: number } | null>(null), [dontAsk, setDontAsk] = useState(false)

  const byId = new Map(tags.map(t => [t.id, t]))
  const live = (ids: string[]) => ids.filter(id => byId.has(id))
  const sessionsOf = (block: BlockRecord) => sessions.filter(s => s.blockId === block.id && s.phase === 'focus').sort((a, b) => a.startedAt - b.startedAt)
  const tagMs = (block: BlockRecord) => {
    const totalsById = new Map<string, number>()
    for (const s of sessionsOf(block)) for (const seg of s.segments) for (const id of new Set(live(seg.tagIds))) totalsById.set(id, (totalsById.get(id) ?? 0) + seg.focusedMs)
    return totalsById
  }
  const active = filter.filter(id => byId.has(id)), filtering = active.length > 0
  const visible = blocks.filter(b => !filtering || active.some(id => (tagMs(b).get(id) ?? 0) > 0))

  const stretchName = (seg: Segment) => {
    const on = live(seg.tagIds).map(id => byId.get(id)!.name)
    return on.length === 0 ? 'Untagged' : on.length <= 2 ? on.join(' · ') : `${on[0]} +${on.length - 1}`
  }
  const Dots = ({ ids }: { ids: string[] }) => <span className="dot-stack card">{live(ids).slice(0, 3).map(id => <i key={id} style={{ background: byId.get(id)!.color }}/>)}</span>

  const card = (block: BlockRecord) => {
    const own = sessionsOf(block), judged = judgeBlock(block, sessions), open = expanded === block.id
    const per = tagMs(block), ranked = [...per.keys()].sort((a, b) => per.get(b)! - per.get(a)!)
    const full = block.setup.focusMin * MIN
    const pills = Array.from({ length: block.setup.sessions }, (_, i) => {
      const s = own[i]
      if (!s) return '#E7E1D4'
      if (s.completed && s.focusedMs >= full) return 'var(--ochre)'
      const p = Math.round(s.focusedMs / full * 100)
      return `linear-gradient(90deg, var(--ochre) 0 ${p}%, #E7E1D4 ${p}% 100%)`
    })
    const timeline = [
      ...own.map(s => ({ at: s.startedAt, session: s })),
      ...block.breaks.map(b => ({ at: b.startedAt, gap: b })),
    ].sort((a, b) => a.at - b.at)
    let n = 0
    return <article key={block.id} className={`history-card ${open ? 'open' : ''}`}>
      <button className="history-summary" aria-expanded={open} onClick={() => setExpanded(open ? null : block.id)}>
        <span className="history-top"><span className="history-range">{clock(block.startedAt, block.startedAt)} – {clock(block.endedAt, block.startedAt)}</span><b>{hm(judged.focusedMs)}</b></span>
        <span className="history-pills">{pills.map((bg, i) => <i key={i} style={{ background: bg }}/>)}</span>
        <span className="history-tags">{ranked.length === 0
          ? <span className="untagged">Untagged</span>
          : <>{ranked.slice(0, 2).map(id => <span key={id} className="history-tag"><i style={{ background: byId.get(id)!.color }}/>{byId.get(id)!.name}</span>)}
            {ranked.length > 2 && <span className="history-tag"><i style={{ background: 'var(--ink-4)' }}/>+{ranked.length - 2}</span>}</>}
        </span>
      </button>
      {open && <div className="history-detail">
        {ranked.length > 0 && <div className="history-chips">{ranked.map(id => <span key={id}><i style={{ background: byId.get(id)!.color }}/>{byId.get(id)!.name}<small>{Math.round(per.get(id)! / MIN)} m</small></span>)}</div>}
        {timeline.map(item => {
          if ('gap' in item && item.gap) return <div key={`b${item.at}`} className="history-break"><span>{item.gap.kind === 'short' ? 'Short break' : 'Long break'}</span><span>{clock(item.gap.startedAt, block.startedAt)} – {clock(item.gap.endedAt, block.startedAt)}</span></div>
          const s = (item as { session: SessionRecord }).session, number = ++n
          const early = !(s.completed && s.focusedMs >= full), key = s.id, many = s.segments.length > 3, showAll = openSessions.has(key)
          const shown = many && !showAll ? s.segments.slice(0, 2) : s.segments
          const rest = s.segments.slice(2), restTags = [...new Set(rest.flatMap(seg => live(seg.tagIds)))]
          return <div key={s.id} className="history-session">
            <div className="history-session-head"><span><b>Session {number}</b><small className={early ? 'early' : ''}>{early ? `ended at ${Math.round(s.focusedMs / MIN)} m` : `${block.setup.focusMin} m`}</small></span><span>{clock(s.startedAt, block.startedAt)} – {clock(s.endedAt, block.startedAt)}</span></div>
            {shown.map((seg, index) => <button key={index} className="history-stretch" onClick={() => { setApplied(null); setRetag({ sessionId: s.id, index, number }) }}>
              <span className="stretch-name">{live(seg.tagIds).length > 0 && <Dots ids={seg.tagIds}/>}<span className={live(seg.tagIds).length ? '' : 'untagged'}>{stretchName(seg)}</span></span>
              <span className="stretch-range">{clock(seg.startedAt, block.startedAt)} – {clock(seg.endedAt, block.startedAt)}<Chevron/></span>
            </button>)}
            {many && <button className="history-stretch more" onClick={() => { const next = new Set(openSessions); if (showAll) next.delete(key); else next.add(key); setOpenSessions(next) }}>
              <span className="stretch-name">{!showAll && <Dots ids={restTags}/>}<b>{showAll ? 'Show fewer' : `${rest.length} more tag changes`}</b></span>
              <svg viewBox="0 0 24 24"><path d={showAll ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}/></svg>
            </button>}
          </div>
        })}
        <div className="history-foot"><span>{block.setup.focusMin} m × {block.setup.sessions}</span>
          <button onClick={() => confirmDelete ? (setDontAsk(false), setDeleting({ id: block.id, focusedMs: judged.focusedMs })) : onDeleteBlock(block.id, false)}>Delete block</button></div>
      </div>}
    </article>
  }

  const retagSession = retag ? sessions.find(s => s.id === retag.sessionId) : null
  const retagSegment = retagSession?.segments[retag!.index]
  const retagBlock = retagSession ? blocks.find(b => b.id === retagSession.blockId) : null

  return <>
    <div className="history-toolbar">
      {filtering
        ? <div className="filter-summary"><span className="dot-stack">{active.slice(0, 3).map(id => <i key={id} style={{ background: byId.get(id)!.color }}/>)}</span>
          <span>{active.length === 1 ? byId.get(active[0])!.name : `${byId.get(active[0])!.name} +${active.length - 1}`} · {visible.length} {visible.length === 1 ? 'block' : 'blocks'}</span>
          <button onClick={() => onFilter([])}>Clear</button></div>
        : <span/>}
      <button className={`round-button filter ${filtering ? 'dark' : ''}`} aria-label="Filter by tag" onClick={() => setSheet('filter')}><svg viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg></button>
    </div>

    {groupByDay(visible).map(({ day, blocks: own }) => {
      const sum = own.reduce((total, b) => total + (filtering ? active.reduce((t, id) => t + (tagMs(b).get(id) ?? 0), 0) : judgeBlock(b, sessions).focusedMs), 0)
      return <section key={day} className="history-day">
        <div className="history-day-head"><h2>{dayLabel(day, now)}</h2><span>{hm(sum)}{filtering ? ' tagged' : ''} · {own.length} {own.length === 1 ? 'block' : 'blocks'}</span></div>
        {own.map(card)}
      </section>
    })}
    {visible.length === 0 && <p className="history-empty">{filtering ? 'Nothing carries these tags yet.' : 'No blocks yet. Finish a session and it lands here.'}</p>}

    {sheet === 'filter' && <div className="sheet-layer">
      <div className="sheet-scrim" onClick={() => setSheet(null)}/>
      <div className="tag-sheet filter-sheet" role="dialog" aria-label="Filter by tag">
        <button className="grabber" aria-label="Close" onClick={() => setSheet(null)}/>
        <div className="sheet-head"><div><h2>{filtering ? `Filter · ${active.length} ${active.length === 1 ? 'tag' : 'tags'}` : 'Filter by tag'}</h2><p>Blocks with any checked tag are shown.</p></div><button onClick={() => setSheet(null)}>Done</button></div>
        <div className="sheet-list">{[...tags].sort((a, b) => a.name.localeCompare(b.name)).map(t => {
          const on = active.includes(t.id)
          return <button key={t.id} className="tag-row" aria-pressed={on} onClick={() => onFilter(on ? active.filter(id => id !== t.id) : [...active, t.id])}>
            <i className="tag-dot" style={{ background: t.color }}/><span className="tag-name">{t.name}</span>
            {on && <span className="tag-check"><CheckIcon/></span>}<span className="tag-total">{totals.get(t.id) ? hm(totals.get(t.id)!) : '—'}</span>
          </button>
        })}</div>
        <div className="sheet-actions">
          <button className={`secondary ${filtering ? '' : 'muted'}`} onClick={() => onFilter([])}>Clear</button>
          <button className="primary wide" onClick={() => setSheet(null)}>{filtering ? `Show ${visible.length} ${visible.length === 1 ? 'block' : 'blocks'}` : 'Show all'}</button>
        </div>
      </div>
    </div>}

    {retag && retagSession && retagSegment && <TagSheet
      title={`Tags · Session ${retag.number}`}
      subtitle={`${clock(retagSegment.startedAt, retagBlock?.startedAt ?? retagSegment.startedAt)} – ${clock(retagSegment.endedAt, retagBlock?.startedAt ?? retagSegment.startedAt)} · ${Math.round(retagSegment.focusedMs / MIN)} m stretch`}
      tags={tags} activeIds={live(retagSegment.tagIds)} totals={totals}
      onToggle={id => { setApplied(null); const on = retagSegment.tagIds.includes(id); onRetag(retagSession, retag.index, on ? retagSegment.tagIds.filter(t => t !== id) : [...live(retagSegment.tagIds), id]) }}
      onClose={() => setRetag(null)}
      footer={<div className="apply-bar"><h3 className="sheet-label">Apply these tags to</h3><div>
        <button className={applied === 'session' ? 'done' : ''} onClick={() => { onApply([retagSession], live(retagSegment.tagIds)); setApplied('session'); setRetag({ ...retag, index: 0 }) }}>{applied === 'session' ? 'Applied to session' : 'Whole session'}</button>
        <button className={applied === 'block' ? 'done' : ''} onClick={() => { if (retagBlock) onApply(sessionsOf(retagBlock), live(retagSegment.tagIds)); setApplied('block'); setRetag({ ...retag, index: 0 }) }}>{applied === 'block' ? 'Applied to block' : 'Whole block'}</button>
      </div></div>}/>}

    {deleting && <div className="sheet-layer">
      <div className="sheet-scrim dark" onClick={() => setDeleting(null)}/>
      <div className="delete-sheet" role="alertdialog" aria-label="Delete block">
        <span className="grabber static"/>
        <h3 className="sheet-label">Delete block</h3>
        <h2>Remove this whole block?</h2>
        <p>{hm(deleting.focusedMs)} of focus and its tags come off your totals and streak. This can't be undone.</p>
        <button className="dont-ask-row" aria-pressed={dontAsk} onClick={() => setDontAsk(!dontAsk)}><span className={`box ${dontAsk ? 'on' : ''}`}>{dontAsk && <CheckIcon/>}</span><span>Don't ask again</span><small>Undo in Settings</small></button>
        <div className="sheet-actions"><button className="secondary" onClick={() => setDeleting(null)}>Keep</button><button className="primary wide" onClick={() => { onDeleteBlock(deleting.id, dontAsk); setDeleting(null); setExpanded(null) }}>Delete block</button></div>
      </div>
    </div>}
  </>
}

function Chevron() { return <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg> }
