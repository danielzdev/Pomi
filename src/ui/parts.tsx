import type { CSSProperties, ReactNode } from 'react'
import type { Mode, Phase } from '../domain/types'
import { ClockIcon, HubIcon, StopwatchIcon } from './icons'

/** Eyebrow + mode-switch glyph + hub glyph. Takeovers show only the hub glyph. */
export function Header({ label, mode, takeover = false, onMode, onHub }: { label: string; mode: Mode; takeover?: boolean; onMode?: () => void; onHub: () => void }) {
  return <header className="screen-header"><span className="screen-eyebrow">{label}</span><div className="header-actions">
    {!takeover && <button className="glyph-button" aria-label={mode === 'pomodoro' ? 'Switch to Stopwatch' : 'Switch to Pomodoro'} onClick={onMode}>{mode === 'pomodoro' ? <StopwatchIcon/> : <ClockIcon/>}</button>}
    <button className="glyph-button" aria-label="Settings, Statistics and History" onClick={onHub}><HubIcon/></button>
  </div></header>
}

export type SegmentVariant = 'paper' | 'paused' | 'teal' | 'takeover-work' | 'takeover-rest'

export function Segments({ count, completed, currentProgress, variant = 'paper', ready = false }: { count: number; completed: number; currentProgress?: number; variant?: SegmentVariant; ready?: boolean }) {
  return <div className={`segments segments-${variant}`}>{Array.from({ length: count }, (_, index) => {
    let kind = ready ? 'ready' : index < completed ? 'done' : 'todo'
    if (!ready && currentProgress !== undefined && index === completed) kind = 'current'
    return <span key={index} className={kind} style={kind === 'current' ? { '--progress': `${Math.max(0, Math.min(100, currentProgress ?? 0))}%` } as CSSProperties : undefined}/>
  })}</div>
}

export function Ring({ display, label, progress, phase, paused, ready }: { display: string; label: string; progress: number; phase: Phase; paused: boolean; ready: boolean }) {
  const degrees = ready ? 360 : Math.max(0, Math.min(360, progress * 360))
  return <div className={`timer-ring phase-${phase} ${paused ? 'is-paused' : ''} ${ready ? 'is-ready' : ''}`} style={{ '--degrees': `${degrees}deg` } as CSSProperties}><div className="ring-inner"><strong>{display}</strong><span>{label}</span></div></div>
}

export function Actions({ children }: { children: ReactNode }) { return <div className="action-zone"><div className="action-row">{children}</div></div> }

export function Toggle({ value, label, sublabel, onChange }: { value: boolean; label: string; sublabel?: string; onChange: () => void }) {
  return <div className="setting-row"><span><b>{label}</b>{sublabel && <small>{sublabel}</small>}</span><button role="switch" aria-checked={value} aria-label={label} className={`toggle ${value ? 'on' : ''}`} onClick={onChange}><i/></button></div>
}

/** 13D-style centred dialog: dark safe default on top, outlined destructive below. */
export function ConfirmDialog({ title, body, keepLabel, confirmLabel, onKeep, onConfirm }: { title: string; body: string; keepLabel: string; confirmLabel: string; onKeep: () => void; onConfirm: () => void }) {
  return <div className="dialog-scrim" role="presentation" onClick={onKeep}><div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()}>
    <div className="dialog-text"><h2 id="dialog-title">{title}</h2><p>{body}</p></div>
    <div className="dialog-actions"><button className="dialog-keep" autoFocus onClick={onKeep}>{keepLabel}</button><button className="dialog-confirm" onClick={onConfirm}>{confirmLabel}</button></div>
  </div></div>
}
