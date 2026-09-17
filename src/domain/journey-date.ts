import { stationCatalogMeta } from './stations.js'

export const JOURNEY_DATE_WINDOW_DAYS = 120

export interface JourneyDateBounds {
  min: string
  max: string
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function todayInRomania(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
  }).format(now)
}

export function journeyDateBounds(now = new Date()): JourneyDateBounds {
  const min = todayInRomania(now)
  const rollingMax = addDays(min, JOURNEY_DATE_WINDOW_DAYS)
  const max = rollingMax < stationCatalogMeta.validUntil
    ? rollingMax
    : stationCatalogMeta.validUntil

  return { min, max }
}
