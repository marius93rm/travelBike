import type {
  DestinationSearchCriteria,
  DirectDestinationOption,
  TrainOption,
  TrainSearchCriteria,
  ProviderOutcome,
} from '../../src/domain/train.js'

export interface ProviderSearchResult {
  options: TrainOption[]
  providerId: string
  fetchedAt: string
  stale?: boolean
  warning?: string
  /** Omitted by legacy adapters and interpreted as a successful, authoritative answer. */
  outcome?: ProviderOutcome
  retryAfterSeconds?: number
}

export interface ProviderCapabilities {
  journeySearch: boolean
  directDestinationDiscovery: boolean
}

export interface TrainDataProvider {
  readonly id: string
  readonly capabilities?: Partial<ProviderCapabilities>
  /** Fast local readiness only; it must never perform an upstream request. */
  isReady?(): boolean
  search(criteria: TrainSearchCriteria): Promise<ProviderSearchResult>
  discoverDirectDestinations?(
    criteria: DestinationSearchCriteria,
  ): Promise<ProviderDestinationSearchResult>
}

export interface ProviderDestinationSearchResult {
  options: DirectDestinationOption[]
  providerId: string
  fetchedAt: string
  stale?: boolean
  warning?: string
  outcome?: ProviderOutcome
  retryAfterSeconds?: number
}
