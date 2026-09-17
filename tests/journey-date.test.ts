import { describe, expect, it } from 'vitest'
import {
  JOURNEY_DATE_WINDOW_DAYS,
  journeyDateBounds,
} from '../src/domain/journey-date.js'

describe('journey date bounds', () => {
  it('caps the rolling window at the published catalog validity', () => {
    expect(JOURNEY_DATE_WINDOW_DAYS).toBe(120)
    expect(journeyDateBounds(new Date('2026-09-03T09:00:00+03:00'))).toEqual({
      min: '2026-09-03',
      max: '2026-12-12',
    })
  })
})
