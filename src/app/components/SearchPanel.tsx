import { ArrowDownUp, Bike, CalendarDays, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { StationId, TrainSearchCriteria } from '../../domain/train.js'
import {
  formatJourneyDate,
  JOURNEY_DATE_WINDOW_DAYS,
  journeyDateBounds,
} from '../../domain/journey-date.js'
import { ro } from '../../i18n/ro.js'
import type { RouteDraftCriteria } from '../route-criteria.js'
import { StationCombobox } from './StationCombobox.js'

interface SearchPanelProps {
  hidden?: boolean
  criteria: RouteDraftCriteria
  loading: boolean
  disabled?: boolean
  disabledReason?: string
  onChange: (next: RouteDraftCriteria) => void
  onSearch: (criteria: TrainSearchCriteria) => void
  onSwap: () => void
}

export function SearchPanel({
  hidden = false,
  criteria,
  loading,
  disabled = false,
  disabledReason,
  onChange,
  onSearch,
  onSwap,
}: SearchPanelProps) {
  const dateBounds = journeyDateBounds()
  const criteriaKey = `${criteria.from}\u0000${criteria.to}`
  const [validityState, setValidityState] = useState({
    key: criteriaKey,
    from: Boolean(criteria.from),
    to: Boolean(criteria.to),
  })
  const stationValidity = useMemo(() => validityState.key === criteriaKey
    ? validityState
    : { key: criteriaKey, from: Boolean(criteria.from), to: Boolean(criteria.to) },
  [validityState, criteriaKey, criteria.from, criteria.to])
  const [submitted, setSubmitted] = useState(false)
  const fromStationRef = useRef<HTMLInputElement>(null)
  const toStationRef = useRef<HTMLInputElement>(null)

  const setFromValidity = useCallback((valid: boolean) => {
    setValidityState((current) => ({ ...current, key: criteriaKey, from: valid }))
  }, [criteriaKey])

  const setToValidity = useCallback((valid: boolean) => {
    setValidityState((current) => ({ ...current, key: criteriaKey, to: valid }))
  }, [criteriaKey])

  useEffect(() => {
    if (!submitted) return
    if (!stationValidity.from) fromStationRef.current?.focus()
    else if (!stationValidity.to) toStationRef.current?.focus()
  }, [submitted, stationValidity])

  function updateStation(key: 'from' | 'to', value: StationId) {
    const otherKey = key === 'from' ? 'to' : 'from'
    const otherValue = criteria[otherKey]
    onChange({
      ...criteria,
      [key]: value,
      [otherKey]: value === otherValue ? criteria[key] : otherValue,
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    const validFrom = Boolean(criteria.from) && stationValidity.from
    const validTo = Boolean(criteria.to) && stationValidity.to
    if (!validFrom || !validTo) {
      setValidityState({ key: criteriaKey, from: validFrom, to: validTo })
      return
    }
    if (loading || dateBounds.catalogExpired) return
    onSearch({ ...criteria, from: criteria.from, to: criteria.to })
  }

  function swapStations() {
    setSubmitted(false)
    setValidityState({
      key: criteriaKey,
      from: Boolean(criteria.to),
      to: Boolean(criteria.from),
    })
    onSwap()
  }

  return (
    <div
      id="route-search-panel"
      role="tabpanel"
      aria-labelledby="route-mode-tab"
      hidden={hidden}
    >
      <div className="search-heading">
        <div>
          <p className="eyebrow">{ro.routeEyebrow}</p>
          <h1 id="route-search-title">{ro.headline}</h1>
          <p>{ro.intro}</p>
          <p className="pilot-coverage-hint">{ro.pilotCoverageHint}</p>
        </div>
        <div className="bike-rule bike-rule-desktop">
          <span className="bike-rule-icon"><Bike size={20} aria-hidden="true" /></span>
          <span><strong>{ro.bikeNormal}</strong>{ro.bikeRule}</span>
        </div>
      </div>

      <form onSubmit={submit} className="search-form">
        <StationCombobox
          key={`from-${criteria.from}`}
          id="from-station"
          label={ro.from}
          stationId={criteria.from}
          invalid={submitted && !stationValidity.from}
          inputRef={fromStationRef}
          onChange={(stationId) => updateStation('from', stationId)}
          onValidityChange={setFromValidity}
        />

        <button className="swap-button" type="button" onClick={swapStations} aria-label={ro.swap}>
          <ArrowDownUp size={21} />
        </button>

        <StationCombobox
          key={`to-${criteria.to}`}
          id="to-station"
          label={ro.to}
          stationId={criteria.to}
          invalid={submitted && !stationValidity.to}
          inputRef={toStationRef}
          onChange={(stationId) => updateStation('to', stationId)}
          onValidityChange={setToValidity}
        />

        <div className="date-field">
          <label htmlFor="journey-date">{ro.date}</label>
          <div className="input-with-icon">
            <CalendarDays size={18} aria-hidden="true" />
            <input
              id="journey-date"
              type="date"
              value={criteria.date}
              min={dateBounds.min}
              max={dateBounds.max}
              disabled={dateBounds.catalogExpired}
              aria-describedby="journey-date-hint"
              onChange={(event) => onChange({ ...criteria, date: event.target.value })}
              required
            />
          </div>
        </div>

        <button
          className="search-button"
          type="submit"
          disabled={loading || dateBounds.catalogExpired}
          aria-describedby={`journey-date-hint${disabledReason ? ' route-action-reason' : ''}`}
        >
          <Search size={19} aria-hidden="true" />
          {disabled ? ro.prepareOperatorSearch : ro.search}
        </button>
      </form>

      {disabledReason ? (
        <p id="route-action-reason" className="date-range-hint route-action-reason">
          {disabledReason}
        </p>
      ) : null}

      <p id="journey-date-hint" className="date-range-hint">
        {dateBounds.catalogExpired
          ? ro.catalogExpiredBody(formatJourneyDate(dateBounds.catalogValidUntil))
          : ro.dateRangeHint(formatJourneyDate(dateBounds.max), JOURNEY_DATE_WINDOW_DAYS)}
      </p>

      <div className="bike-locked">
        <span className="bike-locked-check" aria-hidden="true"><Bike size={18} /></span>
        <span><strong>{ro.bikeOnly}</strong> · {ro.nonFoldableShort}</span>
      </div>

      <div className="bike-rule bike-rule-mobile">
        <span className="bike-rule-icon"><Bike size={20} aria-hidden="true" /></span>
        <span><strong>{ro.bikeNormal}</strong>{ro.bikeRule}</span>
      </div>
    </div>
  )
}
