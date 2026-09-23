import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { TAG_BRIGHT, type Tag } from '../domain/types'
import { CheckIcon, CloseIcon } from './icons'

export const FOLD_AT = 3
export const bright = (color: string) => TAG_BRIGHT[color] ?? color

/** "18 h 02 m", "40 m" — tag totals in the sheet. */
export const tagTotal = (ms: number) => {
  const min = Math.round(ms / 60_000), h = Math.floor(min / 60), m = min % 60
  return h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m`
}

function PlusIcon() { return <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> }
function UpIcon() { return <svg viewBox="0 0 24 24"><path d="M6 14l6-6 6 6"/></svg> }
function SearchIcon() { return <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg> }
function EditIcon() { return <svg viewBox="0 0 24 24"><path d="M4 20h4L20 8l-4-4L4 16z"/></svg> }
export function TrashIcon() { return <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.6h6V7M6.6 7l1 13h8.8l1-13"/></svg> }

/** The pill between the helper line and the action row. */
export function TagHandle({ tags, onOpen }: { tags: Tag[]; onOpen: () => void }) {
  const n = tags.length
  if (n === 0) return <button className="tag-handle add" onClick={onOpen}><PlusIcon/><span>Add tag</span></button>
  if (n <= FOLD_AT) return <button className="tag-handle dots" aria-label={`Tags: ${tags.map(t => t.name).join(', ')}`} onClick={onOpen}>
    <span className="dot-stack">{tags.map(t => <i key={t.id} style={{ background: t.color }}/>)}</span><UpIcon/>
  </button>
  return <button className="tag-handle count" aria-label={`${n} tags on`} onClick={onOpen}>
    <b>{n}</b><span className="divider"/><span className="dot-stack small">{tags.slice(0, 3).map(t => <i key={t.id} style={{ background: bright(t.color) }}/>)}</span><UpIcon/>
  </button>
}

/** Fires `onLongPress` after 420 ms held still; the click that follows is swallowed. */
export function useLongPress(onLongPress: (el: HTMLElement) => void) {
  const timer = useRef<number | undefined>(undefined), fired = useRef(false), origin = useRef<[number, number] | null>(null)
  const cancel = () => { window.clearTimeout(timer.current); origin.current = null }
  useEffect(() => cancel, [])
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      fired.current = false; origin.current = [e.clientX, e.clientY]
      const el = e.currentTarget
      timer.current = window.setTimeout(() => { fired.current = true; onLongPress(el) }, 420)
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (origin.current && Math.hypot(e.clientX - origin.current[0], e.clientY - origin.current[1]) > 8) cancel()
    },
    onPointerUp: cancel, onPointerLeave: cancel, onPointerCancel: cancel,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    /** Wrap the tap handler so a long press doesn't also toggle. */
    tap: (fn: () => void) => () => { if (fired.current) { fired.current = false; return } fn() },
  }
}

export interface TagPress { tag: Tag; rect: DOMRect; on: boolean }

function Pressable({ tag, on, onTap, onLongPress, className, children }: { tag: Tag; on: boolean; onTap: () => void; onLongPress?: (press: TagPress) => void; className: string; children: ReactNode }) {
  const press = useLongPress(el => onLongPress?.({ tag, rect: el.getBoundingClientRect(), on }))
  const { tap, ...handlers } = press
  return <button className={className} {...(onLongPress ? handlers : {})} onClick={tap(onTap)}>{children}</button>
}

export function TagRow({ tag, on, total, onTap, onLongPress, trailing }: { tag: Tag; on: boolean; total?: string; onTap: () => void; onLongPress?: (press: TagPress) => void; trailing?: ReactNode }) {
  return <Pressable tag={tag} on={on} onTap={onTap} onLongPress={onLongPress} className="tag-row">
    <i className="tag-dot" style={{ background: tag.color }}/><span className="tag-name">{tag.name}</span>
    {on && <span className="tag-check"><CheckIcon/></span>}
    {total !== undefined && <span className="tag-total">{total}</span>}
    {trailing}
  </Pressable>
}

/**
 * 2B sheet: On now → Often used → All (A–Z), with the search/create field pinned at the bottom.
 * `totals` is focused ms per tag id; tags without logged time never appear under Often used.
 */
export function TagSheet({ title, subtitle, tags, activeIds, totals, onToggle, onCreate, onLongPress, onClose, footer }: {
  title?: string; subtitle?: string
  tags: Tag[]; activeIds: string[]; totals: Map<string, number>
  onToggle: (id: string) => void; onCreate?: (name: string) => void; onLongPress?: (press: TagPress) => void; onClose: () => void
  footer?: ReactNode
}) {
  const [query, setQuery] = useState(''), [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const q = query.trim().toLowerCase(), searching = q.length > 0
  const byId = new Map(tags.map(t => [t.id, t]))
  const active = activeIds.map(id => byId.get(id)).filter((t): t is Tag => Boolean(t))
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))
  const often = tags.filter(t => !activeIds.includes(t.id) && (totals.get(t.id) ?? 0) > 0)
    .sort((a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0)).slice(0, 5)
  const matches = sorted.filter(t => t.name.toLowerCase().includes(q))
  const exact = tags.some(t => t.name.trim().toLowerCase() === q)
  const total = (t: Tag) => totals.get(t.id) ? tagTotal(totals.get(t.id)!) : '—'

  const create = () => { const name = query.trim(); if (name && onCreate) { onCreate(name); setQuery('') } }
  const submit = () => {
    if (!searching) return
    const hit = tags.find(t => t.name.trim().toLowerCase() === q) ?? matches[0]
    if (hit && (exact || !onCreate)) { onToggle(hit.id); setQuery('') } else if (onCreate) create()
  }

  return <div className="sheet-layer" role="dialog" aria-modal="true" aria-label={title ?? 'Tags'}>
    <div className="sheet-scrim" onClick={onClose}/>
    <div className={`tag-sheet ${focused ? 'focused' : ''}`}>
      <button className="grabber" aria-label="Close" onClick={onClose}/>
      <div className="sheet-head"><div><h2>{searching ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}` : title ?? 'On now'}</h2>{subtitle && !searching && <p>{subtitle}</p>}</div><button onClick={onClose}>Done</button></div>
      {searching
        ? <div className="sheet-list search">
          {matches.map(t => <TagRow key={t.id} tag={t} on={activeIds.includes(t.id)} total={total(t)} onTap={() => onToggle(t.id)} onLongPress={onLongPress}/>)}
          {!exact && onCreate && <button className="create-row" onClick={create}><span className="create-dot"><PlusIcon/></span><span>Create “{query.trim()}”</span></button>}
          {!matches.length && !onCreate && <p className="sheet-empty">No tag by that name.</p>}
        </div>
        : <div className="sheet-browse">
          {title && <h3 className="sheet-label">On now</h3>}
          {active.length
            ? <div className="chips">{active.map(t => <Pressable key={t.id} tag={t} on onTap={() => onToggle(t.id)} onLongPress={onLongPress} className="chip on">
              <i style={{ background: bright(t.color) }}/><span>{t.name}</span><CloseIcon/></Pressable>)}</div>
            : <p className="sheet-empty">Nothing on — this stretch is untagged.</p>}
          {often.length > 0 && <><h3 className="sheet-label">Often used</h3>
            <div className="chips">{often.map(t => <Pressable key={t.id} tag={t} on={false} onTap={() => onToggle(t.id)} onLongPress={onLongPress} className="chip">
              <i style={{ background: t.color }}/><span>{t.name}</span></Pressable>)}</div></>}
          <div className="sheet-label row"><h3>All {tags.length}</h3><span>A–Z</span></div>
          <div className="sheet-list">{sorted.map(t => <TagRow key={t.id} tag={t} on={activeIds.includes(t.id)} total={total(t)} onTap={() => onToggle(t.id)} onLongPress={onLongPress}/>)}</div>
        </div>}
      {footer}
      <div className="sheet-search">
        <label className={`search-field ${focused ? 'focused' : ''}`}>
          <SearchIcon/>
          <input ref={input} value={query} placeholder={onCreate ? 'Search or create a tag' : 'Search tags'} enterKeyHint={onCreate ? 'done' : 'search'} autoCapitalize="none"
            onChange={e => setQuery(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}/>
          {searching && <button className="clear-field" aria-label="Clear" onPointerDown={e => e.preventDefault()} onClick={() => setQuery('')}><CloseIcon/></button>}
        </label>
      </div>
    </div>
  </div>
}

/** Long-press menu: the pressed tag lifts, Edit and Delete sit beside it. */
export function TagMenu({ press, onEdit, onDelete, onClose }: { press: TagPress; onEdit: () => void; onDelete: () => void; onClose: () => void }) {
  const { rect, tag, on } = press
  const menuH = 97, below = rect.bottom + 10 + menuH < window.innerHeight - 40
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - 238 - 12)
  return <div className="menu-layer">
    <div className="menu-scrim" onClick={onClose}/>
    <div className={`menu-lifted ${on ? 'on' : ''}`} style={{ left: rect.left, top: rect.top, width: Math.max(150, Math.min(rect.width, 300)), height: Math.max(34, rect.height), borderRadius: rect.height <= 40 ? rect.height / 2 : 10 }}>
      <i style={{ background: on ? bright(tag.color) : tag.color }}/><span>{tag.name}</span>
    </div>
    <div className="menu-card" role="menu" style={{ left, top: below ? rect.bottom + 10 : rect.top - menuH - 10 }}>
      <button role="menuitem" onClick={onEdit}><span>Edit</span><EditIcon/></button>
      <button role="menuitem" className="danger" onClick={onDelete}><span>Delete</span><TrashIcon/></button>
    </div>
  </div>
}

/** Rename in place over the pressed tag. */
export function TagInlineEdit({ press, error, onCommit }: { press: TagPress; error: string | null; onCommit: (name: string) => void }) {
  const [name, setName] = useState(press.tag.name)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus(); input.current?.select() }, [])
  const { rect, tag } = press
  const height = Math.max(rect.height, 40), top = Math.min(rect.top, window.innerHeight * 0.45)
  return <div className="menu-layer">
    <div className="menu-scrim" onPointerDown={e => e.preventDefault()} onClick={() => onCommit(name)}/>
    <label className="inline-edit" style={{ left: rect.left, top, width: Math.min(Math.max(rect.width + 26, 150), window.innerWidth - 16 - rect.left), height, borderRadius: rect.height <= 40 ? height / 2 : 10 }}>
      <i style={{ background: tag.color }}/>
      <input ref={input} value={name} aria-label="Tag name" enterKeyHint="done" onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onCommit(name) }}/>
    </label>
    {error && <div className="inline-error" style={{ left: rect.left, top: top + height + 14 }}>{error}</div>}
  </div>
}
