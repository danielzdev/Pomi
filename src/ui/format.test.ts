import { describe, expect, it } from 'vitest'
import { formatLap, formatStopwatch, lapNumber } from './format'

const H = 3_600_000
describe('stopwatch digits', () => {
  it('steps from hundredths to hours', () => {
    expect(formatStopwatch(4 * 60_000 + 12_680)).toEqual({ main: '04:12', fraction: '.68', step: 'minutes' })
    expect(formatStopwatch(3 * H + 12 * 60_000 + 40_000)).toEqual({ main: '3:12:40', fraction: '', step: 'hours' })
    expect(formatStopwatch(12 * H + 47 * 60_000 + 9_000)).toEqual({ main: '12:47:09', fraction: '', step: 'tenHours' })
    expect(formatStopwatch(24 * H).main).toBe('24:00:00')
  })

  it('formats laps and pads lap numbers past 99', () => {
    expect(formatLap(41_120)).toBe('00:41.12')
    expect(formatLap(H + 2 * 60_000 + 14_300)).toBe('1:02:14.30')
    expect(lapNumber(7, 12)).toBe('07')
    expect(lapNumber(7, 128)).toBe('007')
  })
})
