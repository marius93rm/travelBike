import { describe, expect, it } from 'vitest'
import { buildCfrBookingUrl } from '../server/providers/cfr-booking-url.js'

function criteria(date: string) {
  return { from: 'codlea' as const, to: 'brasov' as const, date, bike: true as const }
}

describe('buildCfrBookingUrl', () => {
  const now = new Date('2026-10-14T09:00:00.000Z')
  const plannerUrl = 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries'

  it('prefills an eligible domestic journey with the bicycle service selected', () => {
    const link = buildCfrBookingUrl(criteria('2026-10-15'), 'Codlea', 'Brașov', plannerUrl, now)
    const url = new URL(link ?? '')

    expect(url.searchParams.get('DepartureStationName')).toBe('Codlea')
    expect(url.searchParams.get('ArrivalStationName')).toBe('Brașov')
    expect(url.searchParams.get('DepartureDate')).toBe('15.10.2026')
    expect(url.searchParams.get('IsBikesServiceRequired')).toBe('True')
  })

  it('uses the CFR generic planner outside its 30-date window including today', () => {
    expect(buildCfrBookingUrl(criteria('2026-10-13'), 'Codlea', 'Brașov', plannerUrl, now)).toBeUndefined()
    expect(buildCfrBookingUrl(criteria('2026-11-13'), 'Codlea', 'Brașov', plannerUrl, now)).toBeUndefined()
    expect(buildCfrBookingUrl(criteria('2026-11-12'), 'Codlea', 'Brașov', plannerUrl, now)).toBeDefined()
  })

  it('advances the sale window at Romanian midnight even while UTC is on the previous date', () => {
    const beforeMidnight = new Date('2026-10-15T20:59:59.000Z')
    const atMidnight = new Date('2026-10-15T21:00:00.000Z')

    expect(buildCfrBookingUrl(
      criteria('2026-11-14'), 'Codlea', 'Brașov', plannerUrl, beforeMidnight,
    )).toBeUndefined()
    expect(buildCfrBookingUrl(
      criteria('2026-11-14'), 'Codlea', 'Brașov', plannerUrl, atMidnight,
    )).toBeDefined()
  })
})
