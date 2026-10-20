import { ArrowRight, Bike, CornerDownLeft, ExternalLink, MapPin, ShieldCheck, TrainFront } from 'lucide-react'
import { stationsById } from '../../domain/stations.js'
import type { DirectDestinationOption, StationId, TrainOption } from '../../domain/train.js'
import { ro } from '../../i18n/ro.js'
import { formatVerification } from '../format-verification.js'
import { BikeFeeDetails } from './BikeFeeDetails.js'

interface DestinationCardProps {
  option: DirectDestinationOption
  originId: StationId
  onOpenRoute: (destinationId: StationId) => void
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(ro.locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Bucharest',
  }).format(new Date(value))
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat(ro.locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(value))
}

function JourneySummary({ train }: { train: TrainOption }) {
  return (
    <div className="journey-summary">
      <div className="journey-times">
        <time dateTime={train.departureAt}>{formatTime(train.departureAt)}</time>
        <ArrowRight size={17} aria-hidden="true" />
        <time dateTime={train.arrivalAt}>{formatTime(train.arrivalAt)}</time>
      </div>
      <span className="journey-train">{train.trainCategory} {train.trainNumber}</span>
    </div>
  )
}

function JourneySourceDetails({ train }: { train: TrainOption }) {
  return (
    <div className="destination-journey-source">
      <a
        href={train.sourceUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`${ro.sourceVerified(train.source)} ${ro.opensNewTab}`}
      >
        <ShieldCheck size={14} aria-hidden="true" />
        {ro.sourceVerified(train.source)}
        <ExternalLink size={12} aria-hidden="true" />
      </a>
      <small>{formatVerification(train.lastVerifiedAt)}</small>
    </div>
  )
}

export function DestinationCard({
  option,
  originId,
  onOpenRoute,
}: DestinationCardProps) {
  const destination = stationsById.get(option.destinationStationId)?.name
    ?? option.destinationStationId
  const origin = stationsById.get(originId)?.name ?? originId
  const departure = option.departures[0]
  const returnTrain = option.returns[0]

  return (
    <article className="destination-card" aria-labelledby={`destination-${option.destinationStationId}`}>
      <div className="destination-card-heading">
        <div>
          <p className="destination-kicker"><MapPin size={15} aria-hidden="true" /> {ro.directDestination}</p>
          <h3 id={`destination-${option.destinationStationId}`}>{destination}</h3>
        </div>
        <span className="direct-badge"><TrainFront size={15} aria-hidden="true" /> {ro.noChanges}</span>
      </div>

      <div className="destination-journeys">
        <section aria-label={ro.outboundDirect}>
          <p className="journey-label"><Bike size={16} aria-hidden="true" /> {ro.outboundDirect}</p>
          <JourneySummary train={departure} />
          <small><time dateTime={departure.departureAt}>{formatDay(departure.departureAt)}</time> · {departure.durationMinutes} {ro.minutesShort} · {departure.operator}</small>
          <div className="fee-copy destination-fee">
            <BikeFeeDetails train={departure} />
          </div>
          <JourneySourceDetails train={departure} />
        </section>
        <section aria-label={ro.returnDirect}>
          <p className="journey-label"><CornerDownLeft size={16} aria-hidden="true" /> {ro.returnDirect}</p>
          {returnTrain ? (
            <>
              <JourneySummary train={returnTrain} />
              <small>
                <time dateTime={returnTrain.departureAt}>{formatDay(returnTrain.departureAt)}</time>
                {' · '}
                {returnTrain.durationMinutes} {ro.minutesShort} · {returnTrain.operator}
              </small>
              <div className="fee-copy destination-fee">
                <BikeFeeDetails train={returnTrain} />
              </div>
              <JourneySourceDetails train={returnTrain} />
              {option.returns.length > 1 ? (
                <details className="more-return-options">
                  <summary>{ro.moreReturns(option.returns.length - 1)}</summary>
                  <ul>
                    {option.returns.slice(1).map((train) => (
                      <li key={train.id}>
                        <JourneySummary train={train} />
                        <small>
                          <time dateTime={train.departureAt}>{formatDay(train.departureAt)}</time>
                          {' · '}
                          {train.durationMinutes} {ro.minutesShort} · {train.operator}
                        </small>
                        <div className="fee-copy destination-fee">
                          <BikeFeeDetails train={train} />
                        </div>
                        <JourneySourceDetails train={train} />
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          ) : (
            <p className="return-unavailable">{ro.noReturnFound}</p>
          )}
        </section>
      </div>

      <button
        type="button"
        className="destination-route-button"
        aria-label={ro.openRoute(origin, destination)}
        onClick={() => onOpenRoute(option.destinationStationId)}
      >
        {ro.seeRoute}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </article>
  )
}
