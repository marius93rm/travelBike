export const pilotAllowlistVersion = '2026-09-04-hubs-v1'
export const pilotAllowlistVerifiedAt = '2026-09-04'

export interface PilotStationRecord {
  id: string
  county: 'Brașov' | 'Sibiu' | 'Covasna' | 'Mureș'
  source: 'CFR 2025-2026 station catalog; county review pending'
  verifiedAt: string
}

const source = 'CFR 2025-2026 station catalog; county review pending' as const

/**
 * Versioned, reviewed subset. It is deliberately marked incomplete: live
 * readiness stays closed until every station in the four counties is committed.
 */
export const pilotStations: readonly PilotStationRecord[] = [
  { id: 'brasov', county: 'Brașov', source, verifiedAt: pilotAllowlistVerifiedAt },
  { id: 'codlea', county: 'Brașov', source, verifiedAt: pilotAllowlistVerifiedAt },
  { id: 'cfr-20232', county: 'Brașov', source, verifiedAt: pilotAllowlistVerifiedAt },
  { id: 'cfr-20658', county: 'Sibiu', source, verifiedAt: pilotAllowlistVerifiedAt },
  { id: 'cfr-40139', county: 'Covasna', source, verifiedAt: pilotAllowlistVerifiedAt },
  { id: 'cfr-31217', county: 'Mureș', source, verifiedAt: pilotAllowlistVerifiedAt },
  { id: 'cfr-42606', county: 'Mureș', source, verifiedAt: pilotAllowlistVerifiedAt },
] as const

const reviewedStationIds = new Set(pilotStations.map((station) => station.id))
const PILOT_ALLOWLIST_COMPLETE = false

export const pilotRegionLabel = 'Brașov, Sibiu, Covasna și Mureș'

export interface PilotStationConfig {
  stationIds: ReadonlySet<string>
  region: string
  /** An explicit, catalog-valid mapping is required before live readiness. */
  mappingComplete: boolean
  source: 'default_hubs' | 'environment'
  allowlistVersion: string
  verifiedAt: string
}

export function createPilotStationConfig(
  configuredIds = process.env.PILOT_STATION_IDS,
): PilotStationConfig {
  const requested = configuredIds
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  const source = requested?.length ? 'environment' : 'default_hubs'
  const ids = requested?.length ? requested : pilotStations.map((station) => station.id)
  const validIds = ids.filter((id) => reviewedStationIds.has(id))

  return {
    stationIds: new Set(validIds),
    region: pilotRegionLabel,
    mappingComplete: PILOT_ALLOWLIST_COMPLETE
      && source === 'environment'
      && validIds.length === reviewedStationIds.size
      && validIds.length === ids.length,
    source,
    allowlistVersion: pilotAllowlistVersion,
    verifiedAt: pilotAllowlistVerifiedAt,
  }
}

export function routeIsInPilot(
  pilot: PilotStationConfig,
  from: string,
  to?: string,
) {
  return pilot.stationIds.has(from) && (to === undefined || pilot.stationIds.has(to))
}
