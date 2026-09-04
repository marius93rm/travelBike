import {
  ArrowRight,
  Bike,
  CircleHelp,
  ExternalLink,
  ShieldCheck,
  Ticket,
} from 'lucide-react'
import { stationsById } from '../../domain/stations.js'
import type { TrainOption } from '../../domain/train.js'
import { ro } from '../../i18n/ro.js'

interface TrainCardProps {
  train: TrainOption
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(ro.locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Bucharest',
  }).format(new Date(value))
}

function formatVerification(value: string | null) {
  if (!value) return ro.verificationUnknown

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dateOnly = new Date(`${value}T12:00:00Z`)
    return ro.verifiedOn(new Intl.DateTimeFormat(ro.locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Bucharest',
    }).format(dateOnly))
  }

  const date = new Date(value)
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
  }).format(new Date())
  const verifiedDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
  }).format(date)
  const time = formatTime(value)

  if (today === verifiedDate) return ro.verifiedToday(time)
  return ro.verifiedOn(new Intl.DateTimeFormat(ro.locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  }).format(date), time)
}

export function TrainCard({ train }: TrainCardProps) {
  const departure = stationsById.get(train.departureStationId)?.name
  const arrival = stationsById.get(train.arrivalStationId)?.name

  return (
    <article className="train-card" aria-labelledby={`train-${train.id}`}>
      <div className="train-main">
        <div className="time-row">
          <time dateTime={train.departureAt}><span className="sr-only">{ro.departureWord}: </span>{formatTime(train.departureAt)}</time>
          <ArrowRight size={22} aria-hidden="true" />
          <time dateTime={train.arrivalAt}><span className="sr-only">{ro.arrivalWord}: </span>{formatTime(train.arrivalAt)}</time>
        </div>
        <div className="train-identity">
          <h3 className="train-number" id={`train-${train.id}`}>{train.trainCategory} {train.trainNumber}</h3>
          <span>{departure} <span aria-hidden="true">→</span> {arrival}</span>
          <span>{train.durationMinutes} {ro.minutesShort}</span>
          <span>{train.operator}</span>
        </div>
      </div>

      <div className="bike-details">
        <div className="bike-badge"><Bike size={18} aria-hidden="true" /> {ro.bikeAccepted}</div>
        <div className="detail-row">
          <Ticket size={18} aria-hidden="true" />
          <strong>{ro.fee(train.bikeFeeLei === null ? ro.feeUnknown : `${train.bikeFeeLei} lei`)}</strong>
        </div>
        <div className="detail-row muted">
          <CircleHelp size={18} aria-hidden="true" />
          <span>{train.bikeCapacity === null ? ro.capacityUnknown : ro.knownCapacity(train.bikeCapacity)}</span>
        </div>
      </div>

      <div className="train-footer">
        <div className="source-details">
          <span><ShieldCheck size={16} aria-hidden="true" /> {ro.sourceVerified(train.source)}</span>
          <small>{formatVerification(train.lastVerifiedAt)}</small>
        </div>
        <a className="cfr-link" href={train.sourceUrl} target="_blank" rel="noreferrer">
          {train.operator === 'CFR Călători' ? ro.buyOnCfr : ro.verifyAtOperator(train.operator)}
          <ExternalLink size={16} aria-hidden="true" />
          <span className="sr-only">{ro.opensNewTab}</span>
        </a>
      </div>
    </article>
  )
}
