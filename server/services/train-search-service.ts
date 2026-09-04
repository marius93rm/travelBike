import type {
  Reliability,
  ProviderOutcome,
  TrainOption,
  TrainSearchCriteria,
  TrainSearchResponse,
  TrainSearchSource,
} from '../../src/domain/train.js'
import type { TrainDataProvider } from '../providers/train-data-provider.js'

const FALLBACK_WARNING =
  'Sursa live nu este disponibilă. Afișăm ultima informație verificată disponibilă.'
const MAX_CURRENT_AGE_MS = 60 * 60 * 1000

function responseReliability(
  providerId: string,
  options: TrainSearchResponse['options'],
): Reliability {
  if (options.length > 0) return options[0].reliability
  return providerId === 'fallback' ? 'fallback' : 'official'
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
        const outcome = result.stale === true || outsideFreshnessWindow
          ? 'unavailable'
          : reportedOutcome
        sources.push({
          providerId: result.providerId,
          outcome,
          fetchedAt: outcome === 'success' ? result.fetchedAt : null,
          warning: outsideFreshnessWindow
            ? 'Datele providerului nu se încadrează în fereastra de actualitate de o oră.'
            : result.warning ?? null,
        })
        if (outcome === 'success') {
          options.push(...result.options.filter(isBikeCompatible))
        }
      } catch (error) {
        sources.push({
          providerId: provider.id,
          outcome: 'unavailable',
          fetchedAt: null,
          warning: error instanceof Error ? error.message : 'provider failed',
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
    const deduplicated = deduplicate(options)
    const asOf = successes.reduce<string | null>((latest, source) =>
      !latest || (source.fetchedAt && source.fetchedAt > latest) ? source.fetchedAt : latest,
    null)

    return {
      options: deduplicated,
      meta: {
        providerId: firstSuccess?.providerId ?? firstFailure?.providerId ?? 'none',
        reliability: responseReliability(firstSuccess?.providerId ?? 'none', deduplicated),
        fetchedAt: asOf ?? new Date(this.clock()).toISOString(),
        degraded: partial || coverage !== 'covered',
        warning: firstFailure?.warning ?? (partial || coverage !== 'covered' ? FALLBACK_WARNING : null),
        coverage,
        asOf,
        partial,
        sources,
      },
    }
  }
}

function isBikeCompatible(train: TrainOption) {
  return train.bikeAllowed === true && train.bikeType === 'non_foldable'
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
