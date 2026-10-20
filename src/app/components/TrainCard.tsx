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
import { formatVerification } from '../format-verification.js'
import { BikeFeeDetails } from './BikeFeeDetails.js'

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
        <div className="detail-row fee-detail">
          <Ticket size={18} aria-hidden="true" />
          <div className="fee-copy">
            <BikeFeeDetails train={train} />
          </div>
        </div>
        <div className="detail-row muted capacity-detail">
          <CircleHelp size={18} aria-hidden="true" />
          <div className="capacity-copy">
            <span>{train.bikeCapacity === null ? ro.capacityUnknown : ro.knownCapacity(train.bikeCapacity)}</span>
            {train.bikeCapacity === null && train.bikeCapacityEvidence ? (
              <small className="capacity-note">{ro.cfrBikeCapacityNote}</small>
            ) : null}
            {train.bikeCapacityEvidence ? (
              <small className="capacity-evidence">
                <a
                  href={train.bikeCapacityEvidence.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {train.bikeCapacityEvidence.source}
                  <ExternalLink size={13} aria-hidden="true" />
                  <span className="sr-only">{ro.opensNewTab}</span>
                </a>
                <span>{formatVerification(train.bikeCapacityEvidence.verifiedAt)}</span>
              </small>
            ) : null}
          </div>
        </div>
        <div className="detail-row reservation-detail">
          <CircleHelp size={18} aria-hidden="true" />
          <div className="reservation-copy">
            <span>
              <strong>{ro.bikeReservationLabel}:</strong> {ro.bikeReservation[train.bikeReservation]}
            </span>
            {train.operator === 'CFR Călători' ? (
              <small className="reservation-note">{ro.cfrBikeTicketNote}</small>
            ) : null}
            {train.bikeTicketPurchaseEvidence ? (
              <small className="reservation-evidence">
                <a
                  href={train.bikeTicketPurchaseEvidence.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {train.bikeTicketPurchaseEvidence.source}
                  <ExternalLink size={13} aria-hidden="true" />
                  <span className="sr-only">{ro.opensNewTab}</span>
                </a>
                <span>{formatVerification(train.bikeTicketPurchaseEvidence.verifiedAt)}</span>
              </small>
            ) : null}
            {train.bikeReservationEvidence ? (
              <small className="reservation-evidence">
                <a
                  href={train.bikeReservationEvidence.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {train.bikeReservationEvidence.source}
                  <ExternalLink size={13} aria-hidden="true" />
                  <span className="sr-only">{ro.opensNewTab}</span>
                </a>
                <span>{formatVerification(train.bikeReservationEvidence.verifiedAt)}</span>
              </small>
            ) : null}
          </div>
        </div>
      </div>

      <div className="train-footer">
        <div className="source-details">
          <a className="source-link" href={train.sourceUrl} target="_blank" rel="noreferrer">
            <ShieldCheck size={16} aria-hidden="true" />
            {ro.sourceVerified(train.source)}
            <ExternalLink size={13} aria-hidden="true" />
            <span className="sr-only">{ro.opensNewTab}</span>
          </a>
          <small>{formatVerification(train.lastVerifiedAt)}</small>
        </div>
        <a className="cfr-link" href={train.bookingUrl ?? train.sourceUrl} target="_blank" rel="noreferrer">
          {train.operator === 'CFR Călători' ? ro.buyOnCfr : ro.verifyAtOperator(train.operator)}
          <ExternalLink size={16} aria-hidden="true" />
          <span className="sr-only">{ro.opensNewTab}</span>
        </a>
      </div>
    </article>
  )
}
