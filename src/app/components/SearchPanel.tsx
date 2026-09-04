import { ArrowDownUp, Bike, CalendarDays, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { StationId, TrainSearchCriteria } from '../../domain/train.js'
import { ro } from '../../i18n/ro.js'
import { StationCombobox } from './StationCombobox.js'

interface SearchPanelProps {
  criteria: TrainSearchCriteria
  loading: boolean
  onChange: (next: TrainSearchCriteria) => void
  onSearch: () => void
  onSwap: () => void
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function SearchPanel({
  criteria,
  loading,
  onChange,
  onSearch,
  onSwap,
}: SearchPanelProps) {
  const [stationValidity, setStationValidity] = useState({ from: true, to: true })
  const [submitted, setSubmitted] = useState(false)
  const fromStationRef = useRef<HTMLInputElement>(null)
  const toStationRef = useRef<HTMLInputElement>(null)

  const setFromValidity = useCallback((valid: boolean) => {
    setStationValidity((current) => ({ ...current, from: valid }))
  }, [])

  const setToValidity = useCallback((valid: boolean) => {
    setStationValidity((current) => ({ ...current, to: valid }))
  }, [])

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
    if (!stationValidity.from || !stationValidity.to) return
    onSearch()
  }

  function swapStations() {
    setSubmitted(false)
    setStationValidity({ from: true, to: true })
    onSwap()
  }

  return (
    <div
      id="route-search-panel"
      role="tabpanel"
      aria-labelledby="route-mode-tab"
    >
      <div className="search-heading">
        <div>
          <p className="eyebrow">{ro.fallbackRoute}</p>
          <h1 id="journey-search-title">{ro.headline}</h1>
          <p>{ro.intro}</p>
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
              min={new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date())}
              max={addDays(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date()), 120)}
              onChange={(event) => onChange({ ...criteria, date: event.target.value })}
              required
            />
          </div>
        </div>

        <button className="search-button" type="submit" disabled={loading}>
          <Search size={19} aria-hidden="true" />
          {ro.search}
        </button>
      </form>

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
