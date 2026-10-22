import type { TrainOption } from '../domain/train.js'

export type DepartureTimeFilter = 'all' | '10' | '14' | '18'

const bucharestHourFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Bucharest',
})

function departureHourInRomania(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null

  const hour = bucharestHourFormatter.formatToParts(date).find((part) => part.type === 'hour')?.value
  return hour ? Number(hour) : null
}

/** Sorts chronologically and filters in Romanian local time. */
export function filterDepartures(
  options: readonly TrainOption[],
  filter: DepartureTimeFilter,
): TrainOption[] {
  const ordered = [...options].sort((left, right) => {
    const leftDeparture = Date.parse(left.departureAt)
    const rightDeparture = Date.parse(right.departureAt)
    if (!Number.isFinite(leftDeparture)) return Number.isFinite(rightDeparture) ? 1 : 0
    if (!Number.isFinite(rightDeparture)) return -1
    return leftDeparture - rightDeparture
  })

  if (filter === 'all') return ordered

  const minimumHour = Number(filter)
  return ordered.filter((option) => {
    const hour = departureHourInRomania(option.departureAt)
    return hour !== null && hour >= minimumHour
  })
}
