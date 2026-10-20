import { MapPin } from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import {
  normalizeStationSearch,
  searchStations,
  stationsById,
} from '../../domain/stations.js'
import type { Station, StationId } from '../../domain/train.js'
import { ro } from '../../i18n/ro.js'

interface StationComboboxProps {
  id: string
  label: string
  stationId: StationId
  invalid: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  onChange: (stationId: StationId) => void
  onValidityChange: (valid: boolean) => void
}

export function StationCombobox({
  id,
  label,
  stationId,
  invalid,
  inputRef,
  onChange,
  onValidityChange,
}: StationComboboxProps) {
  const listboxId = useId()
  const errorId = `${id}-error`
  const selectedStation = stationsById.get(stationId)
  const [query, setQuery] = useState(selectedStation?.name ?? '')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const activeOptionRef = useRef<HTMLDivElement>(null)
  const suggestions = useMemo(() => searchStations(query), [query])
  const popupOpen = open && suggestions.length > 0

  function selectStation(station: Station) {
    setQuery(station.name)
    setOpen(false)
    setActiveIndex(-1)
    onValidityChange(true)
    onChange(station.id)
  }

  function changeQuery(event: ChangeEvent<HTMLInputElement>) {
    const nextQuery = event.target.value
    setQuery(nextQuery)
    setOpen(true)
    setActiveIndex(-1)
    onValidityChange(
      Boolean(
        selectedStation &&
          normalizeStationSearch(nextQuery) ===
            normalizeStationSearch(selectedStation.name),
      ),
    )
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) =>
        current < 0 ? 0 : Math.min(current + 1, suggestions.length - 1),
      )
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) =>
        current < 0
          ? suggestions.length - 1
          : Math.max(current - 1, 0),
      )
    }

    if (event.key === 'Enter' && open && suggestions[activeIndex]) {
      event.preventDefault()
      selectStation(suggestions[activeIndex])
    }

    if (event.key === 'Tab') {
      setOpen(false)
      setActiveIndex(-1)
    }

    if (event.key === 'Escape') {
      setQuery(selectedStation?.name ?? '')
      setOpen(false)
      setActiveIndex(-1)
      onValidityChange(Boolean(selectedStation))
    }
  }

  const activeOptionId =
    popupOpen && suggestions[activeIndex]
      ? `${id}-option-${suggestions[activeIndex].id}`
      : undefined

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [activeOptionId])

  return (
    <div className="station-field">
      <label htmlFor={id}>{label}</label>
      <div className="station-combobox">
        <MapPin size={18} aria-hidden="true" />
        <input
          id={id}
          className="station-combobox-input"
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck="false"
          value={query}
          placeholder={ro.stationPlaceholder}
          aria-autocomplete="list"
          aria-expanded={popupOpen}
          aria-controls={popupOpen ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          ref={inputRef}
          onChange={changeQuery}
          onFocus={(event) => {
            event.currentTarget.select()
            setOpen(true)
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onKeyDown={handleKeyDown}
        />

        {open ? (
          <p className="sr-only" role="status" aria-live="polite">
            {ro.stationSuggestionsCount(suggestions.length)}
          </p>
        ) : null}
        {popupOpen ? (
          <div className="station-suggestions" id={listboxId} role="listbox">
            {suggestions.map((station, index) => (
              <div
                ref={index === activeIndex ? activeOptionRef : undefined}
                id={`${id}-option-${station.id}`}
                className={index === activeIndex ? 'active' : undefined}
                role="option"
                aria-label={`${station.name}, ${ro.railStation}`}
                aria-selected={station.id === stationId}
                key={station.id}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectStation(station)}
              >
                <span>{station.name}</span>
                <small>{ro.railStation}</small>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {open && suggestions.length === 0 ? (
        <p className="station-no-results">{ro.noStationFound}</p>
      ) : null}
      {invalid ? <p className="field-error" id={errorId} role="alert">{ro.selectStationError}</p> : null}
    </div>
  )
}
