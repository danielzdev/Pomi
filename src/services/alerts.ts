import { Capacitor } from '@capacitor/core'
import { Haptics, NotificationType } from '@capacitor/haptics'
import { KeepAwake } from '@capacitor-community/keep-awake'
import type { AlertTone, Settings } from '../domain/types'

// Placeholder tones synthesised with Web Audio until real sound files are supplied.
type Note = { freq: number; at: number; length: number; type: OscillatorType; gain: number }
const TONE_NOTES: Record<Exclude<AlertTone, 'Silent'>, Note[]> = {
  'Wood block': [{ freq: 1250, at: 0, length: 0.06, type: 'square', gain: 0.08 }],
  'Soft chime': [{ freq: 880, at: 0, length: 1.2, type: 'sine', gain: 0.14 }],
  Marimba: [523, 659, 784].map((freq, i) => ({ freq, at: i * 0.14, length: 0.35, type: 'triangle' as const, gain: 0.14 })),
  Bowl: [{ freq: 330, at: 0, length: 2.6, type: 'sine', gain: 0.12 }],
  Tick: [{ freq: 2200, at: 0, length: 0.025, type: 'square', gain: 0.04 }],
}

let context: AudioContext | null = null

export function playTone(tone: AlertTone): void {
  if (tone === 'Silent') return
  try {
    const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    context ??= new Ctx()
    const c = context, start = c.currentTime + 0.01
    for (const note of TONE_NOTES[tone]) {
      const o = c.createOscillator(), g = c.createGain(), t = start + note.at
      o.type = note.type; o.frequency.value = note.freq
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(note.gain, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + note.length)
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + note.length + 0.05)
    }
  } catch { /* sound is best effort */ }
}

export function vibrate(): void {
  if (Capacitor.isNativePlatform()) void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined)
  else if ('vibrate' in navigator) navigator.vibrate([90, 45, 130])
}

/** Sound and vibration at a phase change, per Settings → Alerts. */
export function signalPhaseChange(settings: Pick<Settings, 'sound' | 'alertTone' | 'vibrate'>): void {
  if (settings.vibrate) vibrate()
  if (settings.sound) playTone(settings.alertTone)
}

export async function setKeepAwake(on: boolean): Promise<void> {
  try {
    if (!(await KeepAwake.isSupported()).isSupported) return
    await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep())
  } catch { /* unsupported platform */ }
}
