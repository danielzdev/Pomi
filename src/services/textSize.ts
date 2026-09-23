import { Capacitor } from '@capacitor/core'
import { TextZoom } from '@capacitor/text-zoom'

/**
 * The user's Dynamic Type scale (1 = default). On iOS the web view ignores Dynamic Type,
 * so it is read natively and applied as -webkit-text-size-adjust on the body.
 * In a browser, `localStorage['pomi.textScale']` stands in for testing layouts.
 */
export async function applyPreferredTextScale(): Promise<number> {
  if (!Capacitor.isNativePlatform()) {
    const stored = Number(localStorage.getItem('pomi.textScale'))
    return Number.isFinite(stored) && stored > 0 ? stored : 1
  }
  try {
    const { value } = await TextZoom.getPreferred()
    await TextZoom.set({ value })
    return value
  } catch { return 1 }
}
