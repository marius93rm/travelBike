import { stationsById } from '../../domain/stations.js'
import { formatJourneyDate } from '../../domain/journey-date.js'
import type { StationId } from '../../domain/train.js'
import { ro } from '../../i18n/ro.js'

interface SearchCriteriaSummaryProps {
  from: StationId
  to?: StationId
  date: string
}

export function SearchCriteriaSummary({ from, to, date }: SearchCriteriaSummaryProps) {
  const fromName = stationsById.get(from)?.name ?? from
  const toName = to ? stationsById.get(to)?.name ?? to : null

  return (
    <p className="results-criteria">
      <span>{toName ? ro.resultsForRoute : ro.destinationsFrom}</span>{' '}
      <strong>{toName ? `${fromName} → ${toName}` : fromName}</strong>
      <span aria-hidden="true"> · </span>
      <time dateTime={date}>{formatJourneyDate(date)}</time>
    </p>
  )
}
