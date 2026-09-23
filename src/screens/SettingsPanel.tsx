import { useRef, useState, type ReactNode } from 'react'
import { blockTotalMinutes } from '../domain/flow'
import { clampDuration, type DurationKey } from '../domain/settings'
import { ALERT_TONES, DEFAULT_SETTINGS, setupFromSettings, type AlertTone, type Settings } from '../domain/types'
import { compactDuration } from '../ui/format'
import { CheckIcon, ChevronIcon } from '../ui/icons'
import { AlertDialog, SubScreen, Toggle } from '../ui/parts'
import { playTone } from '../services/alerts'

const TONE_NOTES: Record<AlertTone, string> = {
  'Wood block': 'Short, dry, no tail',
  'Soft chime': 'One note, fades out',
  Marimba: 'Three rising notes',
  Bowl: 'Long, quiet decay',
  Tick: 'Barely there',
  Silent: 'Vibration only',
}

const DURATIONS: [DurationKey, string, string][] = [
  ['focusMinutes', 'Session', 'min'],
  ['shortBreakMinutes', 'Short break', 'min'],
  ['longBreakMinutes', 'Long break', 'min'],
  ['longBreakEvery', 'Sessions / block', ''],
]

type Page = 'root' | 'tone'

export function SettingsPanel({ settings, tagCount, onChange, onToast, onManageTags }: {
  settings: Settings; tagCount: number
  onChange: (settings: Settings) => void; onToast: (message: string) => void; onManageTags?: () => void
}) {
  const [page, setPage] = useState<Page>('root')
  const [confirmReset, setConfirmReset] = useState(false)
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch })
  const toggle = (key: keyof Settings, label: string, sublabel: string, toast?: string) =>
    <Toggle value={Boolean(settings[key])} label={label} sublabel={sublabel} onChange={() => {
      const on = !settings[key]; set({ [key]: on })
      if (toast) onToast(`${toast} ${on ? 'on' : 'off'}`)
    }}/>

  const setup = setupFromSettings(settings), sessions = settings.longBreakEvery
  const barClass = sessions > 16 ? 'dense' : sessions > 6 ? 'tight' : ''

  return <>
    <div className="block-card">
      <span className="block-card-label">Block preview</span>
      <strong>{compactDuration(blockTotalMinutes(setup))} · {sessions} {sessions === 1 ? 'session' : 'sessions'}</strong>
      <span className="block-card-note">How every block will run with the durations below</span>
      <div className={`proportion-bar ${barClass}`}>{Array.from({ length: sessions }, (_, i) => [
        <span key={`w${i}`} className="work" style={{ flex: setup.focusMin }}/>,
        <span key={`b${i}`} className={i === sessions - 1 ? 'long' : 'short'} style={{ flex: i === sessions - 1 ? setup.longMin : setup.shortMin }}/>,
      ])}</div>
    </div>

    <Section title="Durations" note="Tap a value to type any number of minutes. Changes apply from the next block — one that's running keeps its setup until it ends.">
      {DURATIONS.map(([key, label, unit]) => <DurationRow key={key} label={label} unit={unit} durationKey={key} value={settings[key]}
        onChange={(value, message) => { set({ [key]: value }); if (message) onToast(message) }}/>)}
    </Section>

    <Section title="Flow">
      {toggle('autoStartShortBreaks', 'Auto-start short breaks', 'When a session ends')}
      {toggle('autoStartLongBreak', 'Auto-start long break', 'When the last session of a block ends')}
      {toggle('autoStartSessions', 'Auto-start sessions', 'When a short break ends')}
      {toggle('autoStartNextBlock', 'Start a new block automatically', 'When the long break ends')}
    </Section>

    <Section title="Tags">
      <NavRow label="Manage tags" sublabel="Rename, recolour, delete" value={`${tagCount} ${tagCount === 1 ? 'tag' : 'tags'}`} onClick={onManageTags}/>
      {toggle('carryTags', 'Carry tags into the next session', 'Off starts every session untagged')}
      {toggle('confirmDelete', 'Confirm before deleting', 'Tags here and blocks in History', 'Delete confirmations')}
    </Section>

    <Section title="Alerts">
      {toggle('sound', 'Sound', settings.sound ? settings.alertTone : 'Muted — vibration only')}
      <NavRow label="Alert tone" value={settings.sound ? settings.alertTone : 'Off'} muted={!settings.sound} onClick={() => setPage('tone')}/>
      {toggle('vibrate', 'Vibrate', 'Also when the phone is silenced')}
      {toggle('notifyWhenClosed', 'Notify when closed', 'Lock-screen alert at each change')}
    </Section>

    <Section title="While running">
      {toggle('keepScreenAwake', 'Keep screen awake', 'Dims but stays on')}
      {toggle('stopwatchKeepsRunning', 'Stopwatch keeps running', 'When you leave the screen')}
    </Section>

    <button className="reset-settings" onClick={() => setConfirmReset(true)}>Reset to defaults</button>

    {page === 'tone' && <SubScreen title="Alert tone" onBack={() => setPage('root')}>
      <div className="sub-scroll">
        <div className="settings-section">
          <h2>Plays at every change</h2>
          <div className="settings-card">{ALERT_TONES.map(tone => {
            const on = settings.alertTone === tone
            return <button key={tone} className={`setting-row tone-option ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => {
              set({ alertTone: tone }); playTone(tone)
              onToast(tone === 'Silent' ? 'Silent — no sound will play' : `${tone} · played once`)
            }}><span><b>{tone}</b><small>{TONE_NOTES[tone]}</small></span>{on && <CheckIcon/>}</button>
          })}</div>
          <p className="section-note">Tapping a tone plays it once. With Sound off, only vibration and the lock-screen alert remain.</p>
        </div>
      </div>
    </SubScreen>}

    {confirmReset && <AlertDialog title="Reset to defaults?" body="Durations go back to 25 / 5 / 15 × 4; flow, alerts and tag behaviour to their defaults. Your tags and history are untouched." cta="Reset"
      onCancel={() => setConfirmReset(false)}
      onConfirm={() => { setConfirmReset(false); onChange({ ...DEFAULT_SETTINGS, streakThresholdMin: settings.streakThresholdMin }); onToast('Reset to defaults') }}/>}
  </>
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <section className="settings-section"><h2>{title}</h2><div className="settings-card">{children}</div>{note && <p className="section-note">{note}</p>}</section>
}

function NavRow({ label, sublabel, value, muted = false, onClick }: { label: string; sublabel?: string; value: string; muted?: boolean; onClick?: () => void }) {
  return <button className={`setting-row nav-row ${muted ? 'muted' : ''}`} onClick={onClick} disabled={!onClick}>
    <span><b>{label}</b>{sublabel && <small>{sublabel}</small>}</span>
    <span className="nav-value"><strong>{value}</strong><ChevronIcon/></span>
  </button>
}

function DurationRow({ label, unit, durationKey, value, onChange }: { label: string; unit: string; durationKey: DurationKey; value: number; onChange: (value: number, message: string | null) => void }) {
  const [draft, setDraftState] = useState<string | null>(null)
  const draftRef = useRef<string | null>(null), input = useRef<HTMLInputElement>(null)
  const setDraft = (next: string | null) => { draftRef.current = next; setDraftState(next) }
  const commit = () => {
    const typed = draftRef.current
    if (typed === null) return
    setDraft(null)
    const parsed = parseInt(typed, 10)
    if (Number.isNaN(parsed)) return
    const next = clampDuration(durationKey, parsed)
    onChange(next.value, next.message)
  }
  /** ± while typing steps from the typed number, in one change. */
  const step = (dir: number) => {
    const typed = draftRef.current ? parseInt(draftRef.current, 10) : NaN
    const base = Number.isNaN(typed) ? value : clampDuration(durationKey, typed).value
    setDraft(null); input.current?.blur()
    onChange(clampDuration(durationKey, base + dir).value, null)
  }
  const [lo, hi] = [clampDuration(durationKey, -Infinity).value, clampDuration(durationKey, Infinity).value]
  return <div className="setting-row duration-row">
    <b>{label}</b>
    <div className="stepper">
      <button aria-label={`Less ${label.toLowerCase()}`} disabled={value <= lo} onPointerDown={e => e.preventDefault()} onClick={() => step(-1)}>–</button>
      <label className={`stepper-value ${draft !== null ? 'editing' : ''}`}>
        <input ref={input} aria-label={label} inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" maxLength={3}
          value={draft ?? String(value)}
          onFocus={() => setDraft('')}
          onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}/>
        {unit && <span>{unit}</span>}
      </label>
      <button aria-label={`More ${label.toLowerCase()}`} disabled={value >= hi} onPointerDown={e => e.preventDefault()} onClick={() => step(1)}>+</button>
    </div>
  </div>
}
