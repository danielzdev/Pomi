import type { ReactNode } from 'react'
import type { HubTab } from '../domain/types'
import { CloseIcon } from '../ui/icons'

const TABS: { id: HubTab; label: string }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'history', label: 'History' },
]

/** 14A: full-screen sheet over the timer with a segmented Settings · Statistics · History header. */
export function Hub({ tab, closeLabel, onTab, onClose, children }: { tab: HubTab; closeLabel: string; onTab: (tab: HubTab) => void; onClose: () => void; children: ReactNode }) {
  return <div className="hub" role="dialog" aria-modal="true" aria-label="Settings, Statistics and History">
    <header className="hub-header">
      <div className="hub-segments" role="tablist">{TABS.map(t =>
        <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => onTab(t.id)}>{t.label}</button>)}
      </div>
      <button className="hub-close" aria-label={closeLabel} onClick={onClose}><CloseIcon/></button>
    </header>
    <div key={tab} className="hub-scroll">{children}</div>
  </div>
}

export function HubPlaceholder({ title }: { title: string }) {
  return <div className="hub-placeholder"><b>{title}</b><span>Coming soon</span></div>
}
