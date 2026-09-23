import { useRef, useState } from 'react'
import type { Tag } from '../domain/types'
import { CheckIcon, ChevronIcon, CloseIcon } from '../ui/icons'
import { SubScreen } from '../ui/parts'
import { TrashIcon } from '../ui/tags'

/** Swatch order from the Settings reference: warm to cool to neutral. */
const SWATCHES = ['#B96A1A', '#8A6420', '#A8512B', '#2F5F57', '#58806F', '#7FA294', '#8A8175', '#B4AFA2']

/** "18 h 12 m", "2 h", "40 m" */
const settingsTotal = (ms: number) => {
  const min = Math.round(ms / 60_000), h = Math.floor(min / 60), m = min % 60
  return h ? `${h} h${m ? ` ${m} m` : ''}` : `${m} m`
}

interface Draft { id: string | null; name: string; color: string; error: string | null }

/** Settings → Manage tags: search, sort, rename/recolour, delete one or many. */
export function ManageTags({ tags, totals, nextColor, onBack, onSave, onDelete }: {
  tags: Tag[]; totals: Map<string, number>; nextColor: string
  onBack: () => void
  /** Returns an error message when the name is taken. */
  onSave: (draft: { id: string | null; name: string; color: string }) => string | null
  onDelete: (ids: string[]) => void
}) {
  const [query, setQuery] = useState(''), [sort, setSort] = useState<'az' | 'used'>('az')
  const [selecting, setSelecting] = useState(false), [selected, setSelected] = useState<string[]>([])
  const [edit, setEdit] = useState<Draft | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)

  const q = query.trim().toLowerCase()
  const list = tags.filter(t => t.name.toLowerCase().includes(q))
    .sort((a, b) => sort === 'az' ? a.name.localeCompare(b.name) : (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0))
  const allSelected = list.length > 0 && list.every(t => selected.includes(t.id))

  const openEdit = (tag: Tag | null) => {
    setEdit(tag ? { id: tag.id, name: tag.name, color: tag.color, error: null } : { id: null, name: '', color: nextColor, error: null })
    if (!tag) setTimeout(() => nameInput.current?.focus(), 40)
  }
  const commitEdit = () => {
    if (!edit) return
    const name = edit.name.trim()
    if (!edit.id && !name) { setEdit(null); return }
    const error = onSave({ id: edit.id, name: name || tags.find(t => t.id === edit.id)?.name || '', color: edit.color })
    if (error) setEdit({ ...edit, error }); else setEdit(null)
  }
  const editing = edit?.id ? tags.find(t => t.id === edit.id) : null
  const editTotal = edit?.id ? totals.get(edit.id) ?? 0 : 0

  return <SubScreen title="Tags" onBack={onBack} actions={<>
    <button className={`pill-button ${selecting ? 'dark' : ''}`} onClick={() => { setSelecting(!selecting); setSelected([]) }}>{selecting ? 'Cancel' : 'Select'}</button>
    {!selecting && <button className="round-button dark" aria-label="New tag" onClick={() => openEdit(null)}><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>}
  </>}>
    <div className="manage-search">
      <label className="search-field muted">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
        <input value={query} placeholder="Search tags" autoCapitalize="none" onChange={e => setQuery(e.target.value)}/>
        {q && <button className="clear-field" aria-label="Clear" onClick={() => setQuery('')}><CloseIcon/></button>}
      </label>
    </div>
    <div className="manage-head">
      <h2>{q ? `${list.length} ${list.length === 1 ? 'match' : 'matches'}` : `All ${tags.length}`}</h2>
      {selecting
        ? <button className="select-all" onClick={() => setSelected(allSelected ? [] : list.map(t => t.id))}>{allSelected ? 'Deselect all' : 'Select all'}</button>
        : <div className="mini-segments"><button className={sort === 'az' ? 'active' : ''} onClick={() => setSort('az')}>A–Z</button><button className={sort === 'used' ? 'active' : ''} onClick={() => setSort('used')}>Most used</button></div>}
    </div>
    <div className="manage-list">
      {list.map(t => {
        const on = selected.includes(t.id)
        return <button key={t.id} className="manage-row" aria-pressed={selecting ? on : undefined}
          onClick={() => selecting ? setSelected(on ? selected.filter(id => id !== t.id) : [...selected, t.id]) : openEdit(t)}>
          {selecting && <span className={`check-circle ${on ? 'on' : ''}`}>{on && <CheckIcon/>}</span>}
          <i className="tag-dot" style={{ background: t.color }}/>
          <span className="tag-name">{t.name}</span>
          <span className="tag-total">{settingsTotal(totals.get(t.id) ?? 0)}</span>
          <ChevronIcon/>
        </button>
      })}
      {list.length === 0 && <p className="sheet-empty">No tag by that name.</p>}
    </div>
    {selecting && <div className="bulk-bar">
      <button className={selected.length ? 'armed' : ''} disabled={!selected.length} onClick={() => onDelete(selected)}>
        <TrashIcon/><span>{selected.length ? `Delete ${selected.length} ${selected.length === 1 ? 'tag' : 'tags'}` : 'Select tags to delete'}</span>
      </button>
    </div>}

    {edit && <div className="sheet-layer">
      <div className="sheet-scrim" onClick={commitEdit}/>
      <div className="edit-sheet" role="dialog" aria-label={edit.id ? 'Edit tag' : 'New tag'}>
        <button className="grabber" aria-label="Done" onClick={commitEdit}/>
        <div className="sheet-head"><h2>{edit.id ? 'Edit tag' : 'New tag'}</h2><button onClick={commitEdit}>Done</button></div>
        <div className="edit-body">
          <label className={`name-field ${edit.error ? 'error' : ''}`}>
            <i style={{ background: edit.color }}/>
            <input ref={nameInput} value={edit.name} placeholder="Tag name" enterKeyHint="done" aria-label="Tag name"
              onChange={e => setEdit({ ...edit, name: e.target.value, error: null })} onKeyDown={e => { if (e.key === 'Enter') commitEdit() }}/>
          </label>
          {edit.error && <p className="field-error">{edit.error}</p>}
          <h3 className="sheet-label">Colour</h3>
          <div className="swatches">{SWATCHES.map(color => <button key={color} aria-label={`Colour ${color}`} aria-pressed={edit.color === color}
            className={edit.color === color ? 'on' : ''} style={{ background: color, boxShadow: edit.color === color ? `0 0 0 2px #FBF9F4, 0 0 0 4px ${color}` : 'none' }}
            onClick={() => setEdit({ ...edit, color })}>{edit.color === color && <CheckIcon/>}</button>)}</div>
          {editing && <div className="edit-delete">
            <button onClick={() => { setEdit(null); onDelete([editing.id]) }}><span>Delete tag</span><TrashIcon/></button>
            <p>{editTotal ? `${settingsTotal(editTotal)} logged against it stays in History as untagged time.` : 'No logged time yet — nothing to lose.'}</p>
          </div>}
        </div>
      </div>
    </div>}
  </SubScreen>
}
