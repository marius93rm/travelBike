export type StationId = 'codlea' | 'brasov' | (string & {})

export interface Station {
  id: StationId
  name: string
  /** @deprecated Use providerNames when adding another railway operator. */
  providerName?: string
  /** Exact labels expected by provider-specific journey planners. */
  providerNames?: Readonly<Record<string, string>>
  latitude?: number
  longitude?: number
}

export type BikeType = 'non_foldable'
export type BikeReservation = 'required' | 'not_required' | 'unknown'
export interface BikeReservationEvidence {
  source: string
  sourceUrl: string
  verifiedAt: string
}
export interface BikeCapacityEvidence {
  source: string
  sourceUrl: string
  verifiedAt: string
}
export interface BikeTicketPurchaseEvidence {
  source: string
  sourceUrl: string
  verifiedAt: string
}
export interface BikeFeeBand {
  minDistanceKm: number
  maxDistanceKm: number | null
  feeLei: number
}
export interface BikeFeeEvidenceNote {
  text: string
  source: string
  sourceUrl: string
  verifiedAt: string
}
export interface BikeFeeEvidence {
  source: string
  sourceUrl: string
  verifiedAt: string
  bands?: readonly BikeFeeBand[]
  notes?: readonly BikeFeeEvidenceNote[]
}
export interface ProviderSourceInfo {
  name: string
  url: string
}
export type Reliability = 'official' | 'open_data' | 'fallback'
export type CacheStatus = 'live' | 'cached' | 'mixed'
export type ProviderStatus = 'ready' | 'disabled' | 'unavailable' | 'unsupported'
export type ProviderOutcome =
  | 'success'
  | 'unsupported'
  | 'unavailable'
  | 'rate_limited'
  | 'invalid_payload'
export type CoverageStatus = 'covered' | Exclude<ProviderOutcome, 'success'>

export function reliabilityForProviderId(providerId: string): Reliability | null {
  switch (providerId) {
    case 'cfr': return 'official'
    case 'open-data': return 'open_data'
    case 'fallback': return 'fallback'
    default: return null
  }
}

export interface TrainSearchSource {
  providerId: string
  cached?: boolean
  sourceInfo?: ProviderSourceInfo
  /** Public operator search page prefilled with the requested route when supported. */
  searchUrl?: string
  outcome: ProviderOutcome
  fetchedAt: string | null
  /** Safe user-facing text; provider implementation details are not exposed. */
  warning: string | null
}

export interface TrainOption {
  id: string
  trainNumber: string
  trainCategory: string
  operator: string
  departureStationId: StationId
  arrivalStationId: StationId
  departureAt: string
  arrivalAt: string
  durationMinutes: number
  /** Number of train changes. Discovery requires an explicit zero. */
  changes?: number
  bikeAllowed: boolean
  bikeType: BikeType
  bikeReservation: BikeReservation
  /** Separate source and review date for a reservation policy derived from operator rules. */
  bikeReservationEvidence?: BikeReservationEvidence
  /** Source and review date for limits applying when exact per-train capacity is unknown. */
  bikeCapacityEvidence?: BikeCapacityEvidence
  /** Source and review date for the operator's bicycle-ticket purchase rules. */
  bikeTicketPurchaseEvidence?: BikeTicketPurchaseEvidence
  /** Source and review date for an exact fare or tariff bands used to derive the shown value. */
  bikeFeeEvidence?: BikeFeeEvidence
  /** Known number of spaces. null means the provider supplies no per-train count. */
  bikeCapacity: number | null
  /** Show a numeric amount only when bikeFeeEvidence is also present. */
  bikeFeeLei: number | null
  source: string
  /** Public operator planner prefilled for this journey, when the provider supports it. */
  bookingUrl?: string
  /** Source used to verify this result; kept separate from the ticket/planner link. */
  sourceUrl: string
  lastVerifiedAt: string | null
  reliability: Reliability
}

/** Only explicit operator evidence for a non-foldable bicycle may enter results. */
export function hasConfirmedNonFoldableBikeService(
  train: unknown,
): train is Record<string, unknown> & Pick<TrainOption, 'bikeAllowed' | 'bikeType'> {
  if (!train || typeof train !== 'object' || Array.isArray(train)) return false
  const candidate = train as Record<string, unknown>
  return candidate.bikeAllowed === true && candidate.bikeType === 'non_foldable'
}

export function cacheStatusForSources(sources: readonly TrainSearchSource[]): CacheStatus | undefined {
  const successes = sources.filter((source) => source.outcome === 'success')
  if (successes.length === 0) return undefined

  const cachedCount = successes.filter((source) => source.cached === true).length
  if (cachedCount === 0) return 'live'
  return cachedCount === successes.length ? 'cached' : 'mixed'
}

export interface TrainSearchCriteria {
  from: StationId
  to: StationId
  date: string
  bike: true
}

export interface TrainSearchMeta {
  providerId: string
  /** Null when no provider returned a current answer that can be attributed. */
  reliability: Reliability | null
  fetchedAt: string
  /** Coverage/operational degradation is independent of the source cache state. */
  degraded: boolean
  /** Whether successful provider responses came from live requests, cache, or both. */
  cacheStatus?: CacheStatus
  /** Safe user-facing text; provider implementation details are not exposed. */
  warning: string | null
  /** Whether the requested route/date has a current, authoritative answer. */
  coverage?: CoverageStatus
  /** Operational provider state when the API can distinguish it from route coverage. */
  providerStatus?: ProviderStatus
  /** Latest observation supporting the returned answer; null for no coverage. */
  asOf?: string | null
  /** Some applicable sources failed while another supplied an answer. */
  partial?: boolean
  /** Per-provider outcome for transparent source provenance. */
  sources?: TrainSearchSource[]
}

export interface TrainSearchResponse {
  options: TrainOption[]
  meta: TrainSearchMeta
}

export interface DestinationSearchCriteria {
  from: StationId
  date: string
  bike: true
  direct: true
}

export interface DirectDestinationOption {
  destinationStationId: StationId
  departures: TrainOption[]
  returns: TrainOption[]
}

export interface DestinationSearchResponse {
  options: DirectDestinationOption[]
  meta: TrainSearchMeta
}

export interface CoverageCapability {
  supported: boolean
  coverage: 'available' | 'unsupported' | 'unavailable'
  providerStatus: ProviderStatus
}

export interface CoverageResponse {
  pilot: {
    region: string
    mappingComplete: boolean
    source: 'default_hubs' | 'environment'
    allowlistVersion?: string
    verifiedAt?: string
  }
  route: CoverageCapability
  discovery: CoverageCapability
}
