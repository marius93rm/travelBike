import type {
  CoverageResponse,
  DestinationSearchCriteria,
  DestinationSearchResponse,
  TrainSearchCriteria,
  TrainSearchResponse,
} from '../domain/train.js'
import { hasConfirmedNonFoldableBikeService } from '../domain/train.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasResponseEnvelope(value: unknown): value is { options: unknown[]; meta: Record<string, unknown> } {
  return isRecord(value) && Array.isArray(value.options) && isRecord(value.meta)
}

function assertConfirmedRouteResponse(value: unknown): asserts value is TrainSearchResponse {
  if (!hasResponseEnvelope(value)) throw new Error('Invalid train search response')
  if (!value.options.every(hasConfirmedNonFoldableBikeService)) {
    throw new Error('Train search response lacks confirmed non-foldable bicycle service')
  }
}

function assertConfirmedDestinationResponse(value: unknown): asserts value is DestinationSearchResponse {
  if (!hasResponseEnvelope(value)) throw new Error('Invalid destination response')

  for (const destination of value.options) {
    if (
      !isRecord(destination)
      || typeof destination.destinationStationId !== 'string'
      || !Array.isArray(destination.departures)
      || destination.departures.length === 0
      || !Array.isArray(destination.returns)
    ) {
      throw new Error('Invalid destination journey response')
    }

    for (const journey of [...destination.departures, ...destination.returns]) {
      if (!hasConfirmedNonFoldableBikeService(journey)) {
        throw new Error('Destination response lacks confirmed non-foldable bicycle service')
      }
      if (!isRecord(journey) || journey.changes !== 0) {
        throw new Error('Destination response contains a non-direct journey')
      }
    }
  }
}

export async function fetchCoverage(
  criteria: Pick<DestinationSearchCriteria, 'from' | 'date'> & { to?: string },
  signal?: AbortSignal,
): Promise<CoverageResponse> {
  const params = new URLSearchParams({ from: criteria.from, date: criteria.date })
  if (criteria.to) params.set('to', criteria.to)
  const response = await fetch(`/api/coverage?${params}`, { signal })

  if (!response.ok) throw new Error(`Coverage lookup failed with ${response.status}`)
  return response.json() as Promise<CoverageResponse>
}

export async function fetchTrains(
  criteria: TrainSearchCriteria,
  signal?: AbortSignal,
): Promise<TrainSearchResponse> {
  const params = new URLSearchParams({
    from: criteria.from,
    to: criteria.to,
    date: criteria.date,
    bike: 'true',
  })
  const response = await fetch(`/api/trains?${params}`, { signal })

  if (!response.ok) {
    throw new Error(`Train search failed with ${response.status}`)
  }

  const body: unknown = await response.json()
  assertConfirmedRouteResponse(body)
  return body
}

export async function fetchDestinations(
  criteria: DestinationSearchCriteria,
  signal?: AbortSignal,
): Promise<DestinationSearchResponse> {
  const params = new URLSearchParams({
    from: criteria.from,
    date: criteria.date,
    bike: 'true',
    direct: 'true',
  })
  const response = await fetch(`/api/destinations?${params}`, { signal })

  if (!response.ok) {
    throw new Error(`Destination discovery failed with ${response.status}`)
  }

  const body: unknown = await response.json()
  assertConfirmedDestinationResponse(body)
  return body
}
