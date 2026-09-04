import { Bike, CalendarDays, MapPinned } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type {
  DestinationSearchCriteria,
  StationId,
} from '../../domain/train.js'
import { ro } from '../../i18n/ro.js'
import { StationCombobox } from './StationCombobox.js'

interface DestinationSearchPanelProps {
  criteria: DestinationSearchCriteria
  loading: boolean
  disabled?: boolean
  onChange: (criteria: DestinationSearchCriteria) => void
  onSearch: () => void
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function DestinationSearchPanel({
  criteria,
  loading,
  disabled = false,
  onChange,
  onSearch,
}: DestinationSearchPanelProps) {
  const [stationValid, setStationValid] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const stationRef = useRef<HTMLInputElement>(null)
  const setValidity = useCallback((valid: boolean) => setStationValid(valid), [])
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
  }).format(new Date())

  useEffect(() => {
    if (submitted && !stationValid) stationRef.current?.focus()
  }, [submitted, stationValid])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (!stationValid) return
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
    >
      <div className="search-heading discover-heading">
        <div>
          <p className="eyebrow">{ro.discoverEyebrow}</p>
          <h1 id="journey-search-title">{ro.discoverHeadline}</h1>
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
              type="date"
              value={criteria.date}
              min={today}
              max={addDays(today, 120)}
              onChange={(event) => onChange({ ...criteria, date: event.target.value })}
              required
            />
          </div>
        </div>

        <button className="search-button" type="submit" disabled={loading || disabled}>
          <MapPinned size={19} aria-hidden="true" />
          {ro.showDestinations}
        </button>
      </form>

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
