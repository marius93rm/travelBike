import { describe, expect, it } from 'vitest'
import {
  searchStations,
  stationCatalogMeta,
  stations,
  stationsById,
} from '../src/domain/stations.js'

describe('Romanian station catalog', () => {
  it('contains the commercial stops from the official 2025–2026 timetable', () => {
    expect(stations.length).toBeGreaterThan(1_000)
    expect(stationCatalogMeta).toMatchObject({
      source: 'data.gov.ro / S.C. Informatică Feroviară S.A.',
      validFrom: '2025-12-14',
      validUntil: '2026-12-12',
    })
  })

  it('matches station names without diacritics and ranks prefix matches first', () => {
    const results = searchStations('timisoara', 5)

    expect(results[0]?.name).toBe('Timișoara Nord')
    expect(results.every((station) => station.name.toLocaleLowerCase('ro').includes('timișoara'))).toBe(true)
  })

  it('keeps pilot ids while preserving the official provider names', () => {
    expect(stationsById.get('codlea')).toMatchObject({
      name: 'Codlea',
      providerName: 'Codlea Hm.',
    })
    expect(stationsById.get('brasov')).toMatchObject({
      name: 'Brașov',
      providerName: 'Braşov',
      providerNames: { cfr: 'Braşov' },
    })
  })
})
