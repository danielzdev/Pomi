import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { ActiveTimer } from '../domain/types'
import { remainingMs } from '../domain/timer'

const NOTIFICATION_ID = 41025

export async function cancelTimerNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] })
}

export async function scheduleTimerNotification(timer: ActiveTimer, now: number, enabled = true): Promise<void> {
  await cancelTimerNotification()
  if (!enabled || !Capacitor.isNativePlatform() || timer.status !== 'running') return
  const remaining = remainingMs(timer, now)
  if (remaining === null || remaining <= 0) return
  const permission = await LocalNotifications.checkPermissions()
  const status = permission.display === 'prompt'
    ? (await LocalNotifications.requestPermissions()).display
    : permission.display
  if (status !== 'granted') return
  const [title, body] = timer.mode === 'stopwatch'
    ? ['24 hours reached', 'The stopwatch stopped at 24:00:00. Your laps are saved.']
    : [`${timer.phase === 'focus' ? 'Focus session' : 'Break'} complete`, 'Open Pomi when you are ready for the next phase.']
  await LocalNotifications.schedule({ notifications: [{
    id: NOTIFICATION_ID,
    title,
    body,
    schedule: { at: new Date(now + remaining) },
    extra: { sessionId: timer.id },
  }] })
}
