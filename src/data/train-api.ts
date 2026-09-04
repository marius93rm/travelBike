import type {
  CoverageResponse,
  DestinationSearchCriteria,
  DestinationSearchResponse,
  TrainSearchCriteria,
  TrainSearchResponse,
} from '../domain/train.js'

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

  return response.json() as Promise<TrainSearchResponse>
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

  return response.json() as Promise<DestinationSearchResponse>
}
