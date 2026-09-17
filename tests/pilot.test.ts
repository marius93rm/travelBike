import { describe, expect, it } from 'vitest'
import { stationsById } from '../src/domain/stations.js'
import {
  createPilotStationConfig,
  pilotAllowlistValidation,
  pilotAllowlistVersion,
  pilotStations,
} from '../server/config/pilot.js'

describe('regional pilot allowlist', () => {
  it('is catalog-valid, unique and complete for every target county', () => {
    expect(pilotAllowlistValidation).toEqual({
      duplicateIds: [],
      unknownIds: [],
      missingCounties: [],
      complete: true,
    })
    expect(new Set(pilotStations.map((station) => station.id)).size)
      .toBe(pilotStations.length)
    expect(pilotStations.every((station) => stationsById.has(station.id))).toBe(true)
    expect(pilotStations.every((station) => station.source.length > 0)).toBe(true)
    expect(pilotStations.every((station) => station.sourceUrl.startsWith('https://'))).toBe(true)
    expect(createPilotStationConfig().mappingComplete).toBe(true)
    expect(pilotAllowlistVersion).toBe('2026-09-16-counties-v1')
  })

  it('allows only a restricting environment subset and never marks it complete', () => {
    const restricted = createPilotStationConfig('brasov,codlea')
    const invalid = createPilotStationConfig('cfr-11906')
    const duplicate = createPilotStationConfig(
      [...pilotStations.slice(0, -1).map((station) => station.id), pilotStations[0].id].join(','),
    )

    expect(restricted.stationIds).toEqual(new Set(['brasov', 'codlea']))
    expect(restricted.mappingComplete).toBe(false)
    expect(invalid.stationIds).toEqual(new Set())
    expect(invalid.mappingComplete).toBe(false)
    expect(duplicate.mappingComplete).toBe(false)
  })
})
