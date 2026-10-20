import { describe, expect, it } from 'vitest'
import { scheduledAt } from '../server/lib/date-time.js'

describe('scheduledAt', () => {
  it('uses Romania standard time in winter and summer time in summer', () => {
    expect(scheduledAt('2026-01-15', '12:00')).toBe('2026-01-15T12:00:00+02:00')
    expect(scheduledAt('2026-09-03', '12:00')).toBe('2026-09-03T12:00:00+03:00')
  })

  it('uses the correct offset on either side of the spring clock change', () => {
    expect(scheduledAt('2026-03-29', '02:30')).toBe('2026-03-29T02:30:00+02:00')
    expect(scheduledAt('2026-03-29', '04:30')).toBe('2026-03-29T04:30:00+03:00')
  })

  it('rejects a local time that does not exist during the spring clock change', () => {
    expect(() => scheduledAt('2026-03-29', '03:30')).toThrow(/does not exist/i)
  })

  it('uses standard time after the autumn clock change', () => {
    expect(scheduledAt('2026-10-25', '04:30')).toBe('2026-10-25T04:30:00+02:00')
  })

  it('rejects an ambiguous local time during the autumn clock change', () => {
    expect(() => scheduledAt('2026-10-25', '03:30')).toThrow(/ambiguous/i)
  })

  it('applies an overnight day offset before resolving the local time', () => {
    expect(scheduledAt('2026-09-03', '00:25', 1)).toBe('2026-09-04T00:25:00+03:00')
  })
})
