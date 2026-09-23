import { Fragment } from 'react'
import { blockTotalMinutes } from '../domain/flow'
import { DEFAULT_SETTINGS, type Settings } from '../domain/types'
import { compactDuration } from '../ui/format'
import { ChevronIcon } from '../ui/icons'
import { Toggle } from '../ui/parts'

// Interim v1 settings body shown inside the hub; replaced by the v2 live spec in slice 3.
export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (settings: Settings) => void }) {
  const total = blockTotalMinutes(settings)
  const stepper = (key: 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'longBreakEvery', label: string, step: number, min: number, max: number, suffix: string) =>
    <div className="setting-row stepper-row"><b>{label}</b><div className="stepper"><button disabled={settings[key] <= min} onClick={() => onChange({ ...settings, [key]: Math.max(min, settings[key] - step) })}>−</button><strong>{settings[key]} {suffix}</strong><button disabled={settings[key] >= max} onClick={() => onChange({ ...settings, [key]: Math.min(max, settings[key] + step) })}>+</button></div></div>
  const toggle = (key: keyof Settings, label: string, sublabel: string) => <Toggle value={Boolean(settings[key])} label={label} sublabel={sublabel} onChange={() => onChange({ ...settings, [key]: !settings[key] })}/>
  return <>
    <div className="block-card"><span>Your block</span><strong>{compactDuration(total)} · {settings.longBreakEvery} sessions</strong><div className="proportion-bar">{Array.from({ length: settings.longBreakEvery }, (_, i) => <Fragment key={i}><span className="work" style={{ flex: settings.focusMinutes }}/><span className={i === settings.longBreakEvery - 1 ? 'long' : 'short'} style={{ flex: i === settings.longBreakEvery - 1 ? settings.longBreakMinutes : settings.shortBreakMinutes }}/></Fragment>)}</div></div>
    <section className="settings-section"><h2>Durations</h2><div className="settings-card">{stepper('focusMinutes', 'Session', 5, 5, 90, 'min')}{stepper('shortBreakMinutes', 'Short break', 1, 1, 30, 'min')}{stepper('longBreakMinutes', 'Long break', 1, 1, 30, 'min')}{stepper('longBreakEvery', 'Long break after', 1, 2, 8, 'sess.')}</div></section>
    <section className="settings-section"><h2>Flow</h2><div className="settings-card">{toggle('autoStartBreaks', 'Auto-start breaks', 'Off means you confirm each break')}{toggle('autoStartSessions', 'Auto-start sessions', 'After a short break ends')}{toggle('autoStartAfterLongBreak', 'Auto-start after long break', 'Off means the block ends cleanly')}</div></section>
    <section className="settings-section"><h2>Alerts</h2><div className="settings-card">{toggle('sound', 'Sound', 'Soft chime')}<button className="setting-row tone-row"><b>Alert tone</b><span>Wood block <ChevronIcon/></span></button>{toggle('vibrate', 'Vibrate', 'Also when the phone is silenced')}{toggle('notifyWhenClosed', 'Notify when closed', 'Lock-screen alert at each change')}</div></section>
    <section className="settings-section"><h2>While running</h2><div className="settings-card">{toggle('keepScreenAwake', 'Keep screen awake', 'Dims but stays on')}{toggle('stopwatchKeepsRunning', 'Stopwatch keeps running', 'When you leave the screen')}</div></section>
    <button className="reset-settings" onClick={() => onChange(DEFAULT_SETTINGS)}>Reset to defaults</button><div className="settings-bottom"/>
  </>
}
