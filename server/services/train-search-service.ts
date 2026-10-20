import type {
  Reliability,
  ProviderOutcome,
  TrainOption,
  TrainSearchCriteria,
  TrainSearchResponse,
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

function matchesSearchCriteria(train: TrainOption, criteria: TrainSearchCriteria) {
  const departureAt = new Date(train.departureAt)
  const arrivalAt = new Date(train.arrivalAt)
  return Number.isFinite(departureAt.getTime())
    && Number.isFinite(arrivalAt.getTime())
    && arrivalAt.getTime() > departureAt.getTime()
    && train.departureStationId === criteria.from
    && train.arrivalStationId === criteria.to
    && dateInRomania(departureAt) === criteria.date
}

function responseReliability(
  providerId: string,
  options: TrainSearchResponse['options'],
  hasSuccess: boolean,
): Reliability | null {
  if (options.length > 0) return options[0].reliability
  if (!hasSuccess) return null
  return reliabilityForProviderId(providerId)
}

export class TrainSearchService {
  constructor(
    private readonly providers: TrainDataProvider[],
    private readonly clock: () => number = Date.now,
  ) {}

  async search(criteria: TrainSearchCriteria): Promise<TrainSearchResponse> {
    const sources: TrainSearchSource[] = []
    const options: TrainOption[] = []
    for (const provider of this.providers) {
      if (provider.capabilities?.journeySearch === false) continue
      try {
        const result = await provider.search(criteria)
        const reportedOutcome = result.outcome ?? 'success'
        const observedAt = Date.parse(result.fetchedAt)
        const ageMs = this.clock() - observedAt
        const outsideFreshnessWindow = reportedOutcome === 'success' && (
          !Number.isFinite(observedAt)
          || ageMs > MAX_CURRENT_AGE_MS
          || ageMs < -5 * 60 * 1000
        )
        const hasMismatchedBikeResult = reportedOutcome === 'success' && result.options.some(
          (train) => hasConfirmedNonFoldableBikeService(train)
            && !matchesSearchCriteria(train, criteria),
        )
        const outcome = result.stale === true || outsideFreshnessWindow
          ? 'unavailable'
          : hasMismatchedBikeResult ? 'invalid_payload' : reportedOutcome
        const sourceInfo = result.sourceInfo ?? provider.sourceInfo
        sources.push({
          providerId: result.providerId,
          ...(outcome === 'success' && result.cached === true ? { cached: true } : {}),
          ...(sourceInfo ? { sourceInfo } : {}),
          outcome,
          fetchedAt: outcome === 'success' ? result.fetchedAt : null,
          warning: outsideFreshnessWindow
            ? PROVIDER_FRESHNESS_WARNING
            : hasMismatchedBikeResult
              ? PROVIDER_INVALID_RESULT_WARNING
              : safeProviderWarning(result.warning),
        })
        if (outcome === 'success') {
          options.push(...result.options.filter(hasConfirmedNonFoldableBikeService))
        }
      } catch {
        sources.push({
          providerId: provider.id,
          ...(provider.sourceInfo ? { sourceInfo: provider.sourceInfo } : {}),
          outcome: 'unavailable',
          fetchedAt: null,
          warning: PROVIDER_FAILURE_WARNING,
        })
      }
    }

    const successes = sources.filter((source) => source.outcome === 'success')
    const firstSuccess = successes[0]
    const firstFailure =
      sources.find((source) => source.outcome !== 'success' && source.outcome !== 'unsupported')
      ?? sources.find((source) => source.outcome === 'unsupported')
    const coverage = coverageFor(firstSuccess !== undefined, failureOutcome(firstFailure?.outcome))
    const partial = successes.length > 0 && sources.some(
      (source) => source.outcome !== 'success' && source.outcome !== 'unsupported',
    )
    const cacheStatus = cacheStatusForSources(sources)
    const deduplicated = deduplicate(options)
    const asOf = successes.reduce<string | null>(
      (latest, source) => latestIsoTimestamp(latest, source.fetchedAt),
      null,
    )

    return {
      options: deduplicated,
      meta: {
        providerId: firstSuccess?.providerId ?? firstFailure?.providerId ?? 'none',
        reliability: responseReliability(
          firstSuccess?.providerId ?? 'none',
          deduplicated,
          firstSuccess !== undefined,
        ),
        fetchedAt: asOf ?? new Date(this.clock()).toISOString(),
        degraded: partial || coverage !== 'covered',
        ...(cacheStatus ? { cacheStatus } : {}),
        warning: firstFailure?.warning ?? (
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

function deduplicate(options: TrainOption[]) {
  const seen = new Set<string>()
  return options.filter((option) => {
    const key = [option.operator, option.trainNumber, option.departureStationId, option.arrivalStationId, option.departureAt].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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
