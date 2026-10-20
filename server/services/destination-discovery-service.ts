import type {
  DestinationSearchCriteria,
  DestinationSearchResponse,
  DirectDestinationOption,
  ProviderOutcome,
  Reliability,
  TrainOption,
  TrainSearchSource,
} from '../../src/domain/train.js'
import {
  cacheStatusForSources,
  hasConfirmedNonFoldableBikeService,
  reliabilityForProviderId,
} from '../../src/domain/train.js'
import { dateInRomania } from '../../src/domain/journey-date.js'
import { latestIsoTimestamp } from '../lib/date-time.js'
import {
  PROVIDER_FAILURE_WARNING,
  PROVIDER_FRESHNESS_WARNING,
  PROVIDER_INVALID_RESULT_WARNING,
  safeProviderWarning,
} from '../lib/provider-warnings.js'
import type { TrainDataProvider } from '../providers/train-data-provider.js'

const MAX_CURRENT_AGE_MS = 60 * 60 * 1000

function isCompatibleDirectTrain(train: TrainOption) {
  return (
    hasConfirmedNonFoldableBikeService(train) &&
    train.changes === 0
  )
}

function hasValidJourneyTimes(train: TrainOption) {
  const departureAt = Date.parse(train.departureAt)
  const arrivalAt = Date.parse(train.arrivalAt)
  return Number.isFinite(departureAt)
    && Number.isFinite(arrivalAt)
    && arrivalAt >= departureAt
}

function matchesOutbound(
  train: TrainOption,
  option: DirectDestinationOption,
  criteria: DestinationSearchCriteria,
) {
  return hasValidJourneyTimes(train)
    && train.departureStationId === criteria.from
    && train.arrivalStationId === option.destinationStationId
    && dateInRomania(new Date(train.departureAt)) === criteria.date
}

function matchesReturn(
  train: TrainOption,
  option: DirectDestinationOption,
  criteria: DestinationSearchCriteria,
) {
  return hasValidJourneyTimes(train)
    && train.departureStationId === option.destinationStationId
    && train.arrivalStationId === criteria.from
}

function hasMismatchedDirectBikeResult(
  options: DirectDestinationOption[],
  criteria: DestinationSearchCriteria,
) {
  return options.some((option) => (
    option.departures.some((train) => isCompatibleDirectTrain(train)
      && (option.destinationStationId === criteria.from || !matchesOutbound(train, option, criteria)))
    || option.returns.some((train) => isCompatibleDirectTrain(train)
      && !matchesReturn(train, option, criteria))
  ))
}

function normalizeOption(
  option: DirectDestinationOption,
  criteria: DestinationSearchCriteria,
) {
  const departures = option.departures
    .filter(
      (train) =>
        isCompatibleDirectTrain(train) &&
        matchesOutbound(train, option, criteria),
    )
    .sort((left, right) => left.departureAt.localeCompare(right.departureAt))

  if (departures.length === 0) return null

  const firstArrival = Date.parse(departures[0].arrivalAt)
  const returns = option.returns
    .filter(
      (train) =>
        isCompatibleDirectTrain(train) &&
        matchesReturn(train, option, criteria) &&
        Date.parse(train.departureAt) > firstArrival,
    )
    .sort((left, right) => left.departureAt.localeCompare(right.departureAt))

  if (returns.length === 0) return null

  return { ...option, departures, returns }
}

function reliabilityFor(
  providerId: string,
  options: DirectDestinationOption[],
  hasSuccess: boolean,
): Reliability | null {
  const firstTrain = options[0]?.departures[0]
  if (firstTrain) return firstTrain.reliability
  if (!hasSuccess) return null
  return reliabilityForProviderId(providerId)
}

export class DestinationDiscoveryService {
  constructor(
    private readonly providers: TrainDataProvider[],
    private readonly clock: () => number = Date.now,
  ) {}

  async search(
    criteria: DestinationSearchCriteria,
  ): Promise<DestinationSearchResponse> {
    const sources: TrainSearchSource[] = []
    const options: DirectDestinationOption[] = []

    for (const provider of this.providers) {
      if (
        !provider.discoverDirectDestinations ||
        provider.capabilities?.directDestinationDiscovery === false
      ) continue

      try {
        const result = await provider.discoverDirectDestinations(criteria)
        const reportedOutcome = result.outcome ?? 'success'
        const observedAt = Date.parse(result.fetchedAt)
        const ageMs = this.clock() - observedAt
        const outsideFreshnessWindow = reportedOutcome === 'success' && (
          !Number.isFinite(observedAt)
          || ageMs > MAX_CURRENT_AGE_MS
          || ageMs < -5 * 60 * 1000
        )
        const mismatchedDirectBikeResult = reportedOutcome === 'success'
          && hasMismatchedDirectBikeResult(result.options, criteria)
        const outcome = result.stale === true || outsideFreshnessWindow
          ? 'unavailable'
          : mismatchedDirectBikeResult ? 'invalid_payload' : reportedOutcome
        const sourceInfo = result.sourceInfo ?? provider.sourceInfo
        sources.push({
          providerId: result.providerId, outcome,
          ...(outcome === 'success' && result.cached === true ? { cached: true } : {}),
          ...(sourceInfo ? { sourceInfo } : {}),
          fetchedAt: outcome === 'success' ? result.fetchedAt : null,
          warning: outsideFreshnessWindow
            ? PROVIDER_FRESHNESS_WARNING
            : mismatchedDirectBikeResult
              ? PROVIDER_INVALID_RESULT_WARNING
              : safeProviderWarning(result.warning),
        })
        if (outcome === 'success') {
          options.push(...result.options
            .filter((option) => option.destinationStationId !== criteria.from)
            .map((option) => normalizeOption(option, criteria))
            .filter((option): option is DirectDestinationOption => option !== null))
        }
      } catch {
        sources.push({
          providerId: provider.id, outcome: 'unavailable', fetchedAt: null,
          ...(provider.sourceInfo ? { sourceInfo: provider.sourceInfo } : {}),
          warning: PROVIDER_FAILURE_WARNING,
        })
      }
    }

    const successes = sources.filter((source) => source.outcome === 'success')
    const failure =
      sources.find((source) => source.outcome !== 'success' && source.outcome !== 'unsupported')
      ?? sources.find((source) => source.outcome === 'unsupported')
    const coverage = coverageFor(successes.length > 0, failureOutcome(failure?.outcome))
    const partial = successes.length > 0 && sources.some(
      (source) => source.outcome !== 'success' && source.outcome !== 'unsupported',
    )
    const cacheStatus = cacheStatusForSources(sources)
    const asOf = successes.reduce<string | null>(
      (latest, source) => latestIsoTimestamp(latest, source.fetchedAt),
      null,
    )
    const normalized = deduplicateDestinations(options).sort((left, right) =>
      left.departures[0].departureAt.localeCompare(right.departures[0].departureAt),
    )
    return {
      options: normalized,
      meta: {
        providerId: successes[0]?.providerId ?? failure?.providerId ?? 'none',
        reliability: reliabilityFor(
          successes[0]?.providerId ?? 'none',
          normalized,
          successes.length > 0,
        ),
        fetchedAt: asOf ?? new Date(this.clock()).toISOString(),
        degraded: partial || coverage !== 'covered',
        ...(cacheStatus ? { cacheStatus } : {}),
        warning: failure?.warning ?? (
          coverage !== 'unsupported' && (partial || coverage !== 'covered')
            ? PROVIDER_FAILURE_WARNING
            : null
        ),
        coverage,
        asOf,
        partial,
        sources,
      },
    }
  }
}

function deduplicateDestinations(options: DirectDestinationOption[]) {
  const byDestination = new Map<string, DirectDestinationOption>()
  for (const option of options) {
    const existing = byDestination.get(option.destinationStationId)
    if (!existing) {
      byDestination.set(option.destinationStationId, option)
      continue
    }
    const merge = (left: TrainOption[], right: TrainOption[]) => {
      const seen = new Set(left.map((train) => train.id))
      return [...left, ...right.filter((train) => !seen.has(train.id))]
        .sort((a, b) => a.departureAt.localeCompare(b.departureAt))
    }
    byDestination.set(option.destinationStationId, {
      ...existing,
      departures: merge(existing.departures, option.departures),
      returns: merge(existing.returns, option.returns),
    })
  }
  return [...byDestination.values()]
}

function coverageFor(
  hasSuccess: boolean,
  failure: Exclude<ProviderOutcome, 'success'> | undefined,
) {
  return hasSuccess ? 'covered' : failure ?? 'unsupported'
}

function failureOutcome(outcome: ProviderOutcome | undefined): Exclude<ProviderOutcome, 'success'> | undefined {
  return outcome && outcome !== 'success' ? outcome : undefined
}
