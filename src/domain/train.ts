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
export type Reliability = 'official' | 'open_data' | 'fallback'
export type ProviderOutcome =
  | 'success'
  | 'unsupported'
  | 'unavailable'
  | 'rate_limited'
  | 'invalid_payload'
export type CoverageStatus = 'covered' | Exclude<ProviderOutcome, 'success'>

export interface TrainSearchSource {
  providerId: string
  outcome: ProviderOutcome
  fetchedAt: string | null
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
  /** Known number of spaces. null means the source does not publish capacity. */
  bikeCapacity: number | null
  bikeFeeLei: number | null
  source: string
  sourceUrl: string
  lastVerifiedAt: string | null
  reliability: Reliability
}

export interface TrainSearchCriteria {
  from: StationId
  to: StationId
  date: string
  bike: true
}

export interface TrainSearchMeta {
  providerId: string
  reliability: Reliability
  fetchedAt: string
  degraded: boolean
  warning: string | null
  /** Whether the requested route/date has a current, authoritative answer. */
  coverage?: CoverageStatus
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
  providerStatus: 'ready' | 'disabled' | 'unsupported'
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
