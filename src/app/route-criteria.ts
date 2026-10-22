import { journeyDateBounds } from '../domain/journey-date.js'
import type { StationId, TrainSearchCriteria } from '../domain/train.js'
import { stationsById } from '../domain/stations.js'

export type RouteDraftCriteria = Omit<TrainSearchCriteria, 'from' | 'to'> & {
  from: StationId | ''
  to: StationId | ''
}

export function createEmptyRouteDraft(date: string): RouteDraftCriteria {
  return { from: '', to: '', date, bike: true }
}

export function parseRouteCriteria(search: string, now = new Date()): TrainSearchCriteria | null {
  const params = new URLSearchParams(search)
  const from = params.get('from')
  const to = params.get('to')
  const date = params.get('date')

  if (!from || !to || !date || from === to) return null
  if (!stationsById.has(from) || !stationsById.has(to)) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsedDate = new Date(`${date}T00:00:00.000Z`)
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return null
  }

  const bounds = journeyDateBounds(now)
  if (bounds.catalogExpired || date < bounds.min || date > bounds.max) return null

  return { from, to, date, bike: true }
}

export function routeCriteriaSearch(criteria: TrainSearchCriteria) {
  const params = new URLSearchParams({
    from: criteria.from,
    to: criteria.to,
    date: criteria.date,
  })
  return `?${params.toString()}`
}
