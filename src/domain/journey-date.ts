import { stationCatalogMeta } from './stations.js'

/** Search cap based on CFR's current advance-purchase window, including today. */
export const JOURNEY_DATE_WINDOW_DAYS = 30
export const STATION_CATALOG_EXPIRY_WARNING_DAYS = 60

export interface JourneyDateBounds {
  min: string
  max: string
  catalogExpired: boolean
  catalogExpiringSoon: boolean
  catalogValidUntil: string
}

const romaniaDateTimeParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function todayInRomania(now: Date) {
  return dateInRomania(now)
}

function romanianClockParts(date: Date) {
  const parts = new Map(
    romaniaDateTimeParts.formatToParts(date).map(({ type, value }) => [type, value]),
  )
  return {
    year: Number(parts.get('year')),
    month: Number(parts.get('month')),
    day: Number(parts.get('day')),
    hour: Number(parts.get('hour')),
    minute: Number(parts.get('minute')),
    second: Number(parts.get('second')),
  }
}

/** Formats a calendar date in Romania without depending on a locale's output order. */
export function dateInRomania(date: Date) {
  const { year, month, day } = romanianClockParts(date)
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function millisecondsUntilNextRomaniaMidnight(now = new Date()) {
  const current = romanianClockParts(now)
  const nextDate = new Date(Date.UTC(current.year, current.month - 1, current.day + 1))
  const nextLocalMidnight = Date.UTC(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth(),
    nextDate.getUTCDate(),
  )

  let nextMidnightUtc = nextLocalMidnight
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actualLocal = romanianClockParts(new Date(nextMidnightUtc))
    const actualAsUtc = Date.UTC(
      actualLocal.year,
      actualLocal.month - 1,
      actualLocal.day,
      actualLocal.hour,
      actualLocal.minute,
      actualLocal.second,
    )
    const adjustment = nextLocalMidnight - actualAsUtc
    if (adjustment === 0) break
    nextMidnightUtc += adjustment
  }

  return Math.max(1, nextMidnightUtc - now.getTime() + 100)
}

export function journeyDateBounds(now = new Date()): JourneyDateBounds {
  const min = todayInRomania(now)
  const catalogValidUntil = stationCatalogMeta.validUntil
  const catalogExpired = min > catalogValidUntil
  const daysUntilCatalogExpiry = (
    Date.parse(`${catalogValidUntil}T12:00:00Z`) - Date.parse(`${min}T12:00:00Z`)
  ) / 86_400_000
  const catalogExpiringSoon = daysUntilCatalogExpiry >= 0
    && daysUntilCatalogExpiry <= STATION_CATALOG_EXPIRY_WARNING_DAYS
  const rollingMax = addDays(min, JOURNEY_DATE_WINDOW_DAYS - 1)
  const max = catalogExpired
    ? min
    : rollingMax < catalogValidUntil ? rollingMax : catalogValidUntil

  return { min, max, catalogExpired, catalogExpiringSoon, catalogValidUntil }
}

export function formatJourneyDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date

  const parsed = new Date(`${date}T12:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return date
  }

  return new Intl.DateTimeFormat('ro-RO', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(parsed)
}
