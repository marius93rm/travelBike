import { Bike, CalendarDays, MapPinned } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent, type Ref } from 'react'
import type {
  DestinationSearchCriteria,
  StationId,
} from '../../domain/train.js'
import {
  formatJourneyDate,
  JOURNEY_DATE_WINDOW_DAYS,
  journeyDateBounds,
} from '../../domain/journey-date.js'
import { ro } from '../../i18n/ro.js'
import { StationCombobox } from './StationCombobox.js'

interface DestinationSearchPanelProps {
  hidden?: boolean
  criteria: DestinationSearchCriteria
  dateInputRef?: Ref<HTMLInputElement>
  loading: boolean
  disabled?: boolean
  disabledReason?: string
  onChange: (criteria: DestinationSearchCriteria) => void
  onSearch: () => void
}

export function DestinationSearchPanel({
  hidden = false,
  criteria,
  dateInputRef,
  loading,
  disabled = false,
  disabledReason,
  onChange,
  onSearch,
}: DestinationSearchPanelProps) {
  const dateBounds = journeyDateBounds()
  const [stationValid, setStationValid] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const stationRef = useRef<HTMLInputElement>(null)
  const setValidity = useCallback((valid: boolean) => setStationValid(valid), [])
  useEffect(() => {
    if (submitted && !stationValid) stationRef.current?.focus()
  }, [submitted, stationValid])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (loading || dateBounds.catalogExpired || disabled || !stationValid) return
    onSearch()
  }

  function updateStation(from: StationId) {
    onChange({ ...criteria, from })
  }

  return (
    <div
      id="discover-search-panel"
      role="tabpanel"
      aria-labelledby="discover-mode-tab"
      hidden={hidden}
    >
      <div className="search-heading discover-heading">
        <div>
          <p className="eyebrow">{ro.discoverEyebrow}</p>
          <h1 id="discover-search-title">{ro.discoverHeadline}</h1>
          <p>{ro.discoverIntro}</p>
        </div>
        <div className="bike-rule bike-rule-desktop">
          <span className="bike-rule-icon"><Bike size={20} aria-hidden="true" /></span>
          <span><strong>{ro.directOnly}</strong>{ro.discoverRule}</span>
        </div>
      </div>

      <form onSubmit={submit} className="discover-form">
        <StationCombobox
          key={`discover-${criteria.from}`}
          id="discover-from-station"
          label={ro.departureFrom}
          stationId={criteria.from}
          invalid={submitted && !stationValid}
          inputRef={stationRef}
          onChange={updateStation}
          onValidityChange={setValidity}
        />

        <div className="date-field">
          <label htmlFor="discover-date">{ro.departureDate}</label>
          <div className="input-with-icon">
            <CalendarDays size={18} aria-hidden="true" />
            <input
              id="discover-date"
              ref={dateInputRef}
              type="date"
              value={criteria.date}
              min={dateBounds.min}
              max={dateBounds.max}
              disabled={dateBounds.catalogExpired}
              aria-describedby="discover-date-hint"
              onChange={(event) => onChange({ ...criteria, date: event.target.value })}
              required
            />
          </div>
        </div>

        <button
          className="search-button"
          type="submit"
          disabled={loading || disabled || dateBounds.catalogExpired}
          aria-describedby={`discover-date-hint${disabledReason ? ' discover-action-reason' : ''}`}
        >
          <MapPinned size={19} aria-hidden="true" />
          {ro.showDestinations}
        </button>
      </form>

      {disabledReason ? (
        <p id="discover-action-reason" className="date-range-hint discovery-action-reason">
          {disabledReason}
        </p>
      ) : null}

      <p id="discover-date-hint" className="date-range-hint">
        {dateBounds.catalogExpired
          ? ro.catalogExpiredBody(formatJourneyDate(dateBounds.catalogValidUntil))
          : ro.dateRangeHint(formatJourneyDate(dateBounds.max), JOURNEY_DATE_WINDOW_DAYS)}
      </p>

      <div className="bike-locked">
        <span className="bike-locked-check" aria-hidden="true"><Bike size={18} /></span>
        <span><strong>{ro.directBikeOnly}</strong> · {ro.returnAfterArrival}</span>
      </div>

      <div className="bike-rule bike-rule-mobile">
        <span className="bike-rule-icon"><Bike size={20} aria-hidden="true" /></span>
        <span><strong>{ro.directOnly}</strong>{ro.discoverRule}</span>
      </div>
    </div>
  )
}
