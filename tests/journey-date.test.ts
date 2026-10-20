import { describe, expect, it } from 'vitest'
import {
  dateInRomania,
  formatJourneyDate,
  JOURNEY_DATE_WINDOW_DAYS,
  journeyDateBounds,
  millisecondsUntilNextRomaniaMidnight,
  STATION_CATALOG_EXPIRY_WARNING_DAYS,
} from '../src/domain/journey-date.js'

describe('journey date bounds', () => {
  it('formats the Romanian local calendar date independently of locale output conventions', () => {
    expect(dateInRomania(new Date('2026-10-15T20:59:59Z'))).toBe('2026-10-15')
    expect(dateInRomania(new Date('2026-10-15T21:00:00Z'))).toBe('2026-10-16')
  })

  it('uses a 30-calendar-day window that includes today', () => {
    expect(JOURNEY_DATE_WINDOW_DAYS).toBe(30)
    expect(journeyDateBounds(new Date('2026-09-03T09:00:00+03:00'))).toEqual({
      min: '2026-09-03',
      max: '2026-10-02',
      catalogExpired: false,
      catalogExpiringSoon: false,
      catalogValidUntil: '2026-12-12',
    })
  })

  it('warns within 60 calendar days of catalog expiry, including the threshold date', () => {
    expect(STATION_CATALOG_EXPIRY_WARNING_DAYS).toBe(60)
    expect(journeyDateBounds(new Date('2026-10-13T09:00:00+03:00')).catalogExpiringSoon)
      .toBe(true)
    expect(journeyDateBounds(new Date('2026-10-12T09:00:00+03:00')).catalogExpiringSoon)
      .toBe(false)
  })

  it('still caps the search window at the published catalog validity', () => {
    expect(journeyDateBounds(new Date('2026-11-20T09:00:00+02:00'))).toEqual({
      min: '2026-11-20',
      max: '2026-12-12',
      catalogExpired: false,
      catalogExpiringSoon: true,
      catalogValidUntil: '2026-12-12',
    })
  })

  it('closes the date window when the published catalog has expired', () => {
    expect(journeyDateBounds(new Date('2026-12-13T09:00:00+02:00'))).toEqual({
      min: '2026-12-13',
      max: '2026-12-13',
      catalogExpired: true,
      catalogExpiringSoon: false,
      catalogValidUntil: '2026-12-12',
    })
  })

  it('formats the selectable limit as a Romanian calendar date', () => {
    expect(formatJourneyDate('2026-12-12')).toBe('12 decembrie 2026')
    expect(formatJourneyDate('2026-02-30')).toBe('2026-02-30')
  })

  it('schedules its next date refresh just after Bucharest midnight', () => {
    expect(millisecondsUntilNextRomaniaMidnight(new Date('2026-12-12T21:59:00Z')))
      .toBe(60_100)
  })

  it('keeps the next Romanian midnight correct across the spring clock change', () => {
    expect(millisecondsUntilNextRomaniaMidnight(new Date('2026-03-28T22:30:00Z')))
      .toBe(81_000_100)
  })
})
