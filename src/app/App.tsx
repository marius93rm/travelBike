import { AlertTriangle, Bike, CheckCircle2, Compass, Info, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fetchCoverage, fetchDestinations, fetchTrains } from '../data/train-api.js'
import type {
  DestinationSearchCriteria,
  DestinationSearchResponse,
  StationId,
  TrainSearchCriteria,
  TrainSearchResponse,
} from '../domain/train.js'
import { ro } from '../i18n/ro.js'
import { BrandMark } from './components/BrandMark.js'
import { DestinationCard } from './components/DestinationCard.js'
import { DestinationSearchPanel } from './components/DestinationSearchPanel.js'
import { RouteLine } from './components/RouteLine.js'
import { SearchModeTabs, type SearchMode } from './components/SearchModeTabs.js'
import { SearchPanel } from './components/SearchPanel.js'
import { TrainCard } from './components/TrainCard.js'

function todayInRomania() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
  }).format(new Date())
}

const initialCriteria: TrainSearchCriteria = {
  from: 'codlea',
  to: 'brasov',
  date: todayInRomania(),
  bike: true,
}

const initialDestinationCriteria: DestinationSearchCriteria = {
  from: 'brasov',
  date: todayInRomania(),
  bike: true,
  direct: true,
}

export function App() {
  const [mode, setMode] = useState<SearchMode>('route')
  const [draft, setDraft] = useState(initialCriteria)
  const [query, setQuery] = useState(initialCriteria)
  const [data, setData] = useState<TrainSearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [destinationDraft, setDestinationDraft] = useState(initialDestinationCriteria)
  const [destinationQuery, setDestinationQuery] = useState<DestinationSearchCriteria | null>(null)
  const [destinationData, setDestinationData] = useState<DestinationSearchResponse | null>(null)
  const [destinationLoading, setDestinationLoading] = useState(false)
  const [destinationError, setDestinationError] = useState(false)
  const [discoveryCapability, setDiscoveryCapability] = useState<
    'unknown' | 'checking' | 'available' | 'unsupported' | 'unavailable'
  >('unknown')
  const resultsTitleRef = useRef<HTMLHeadingElement>(null)
  const destinationResultsTitleRef = useRef<HTMLHeadingElement>(null)
  const focusResultsAfterSearch = useRef(false)
  const focusDestinationsAfterSearch = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    fetchTrains(query, controller.signal)
      .then((response) => setData(response))
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(true)
        setData(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [query])

  useEffect(() => {
    if (!destinationQuery) return
    const controller = new AbortController()

    fetchDestinations(destinationQuery, controller.signal)
      .then((response) => setDestinationData(response))
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setDestinationError(true)
        setDestinationData(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setDestinationLoading(false)
      })

    return () => controller.abort()
  }, [destinationQuery])

  useEffect(() => {
    if (mode !== 'discover') return
    const controller = new AbortController()
    fetchCoverage(destinationDraft, controller.signal)
      .then((coverage) => {
        if (coverage.discovery.coverage === 'available') {
          setDiscoveryCapability('available')
        } else if (coverage.discovery.coverage === 'unsupported') {
          setDiscoveryCapability('unsupported')
        } else {
          setDiscoveryCapability('unavailable')
        }
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setDiscoveryCapability('unavailable')
      })
    return () => controller.abort()
  }, [destinationDraft, mode])

  useEffect(() => {
    if (!loading && focusResultsAfterSearch.current) {
      resultsTitleRef.current?.focus()
      focusResultsAfterSearch.current = false
    }
  }, [loading])

  useEffect(() => {
    if (!destinationLoading && focusDestinationsAfterSearch.current) {
      destinationResultsTitleRef.current?.focus()
      focusDestinationsAfterSearch.current = false
    }
  }, [destinationLoading])

  function runSearch(next: TrainSearchCriteria) {
    focusResultsAfterSearch.current = true
    setLoading(true)
    setError(false)
    setQuery(next)
  }

  function runDestinationSearch(next: DestinationSearchCriteria) {
    if (discoveryCapability !== 'available') return
    focusDestinationsAfterSearch.current = true
    setDestinationLoading(true)
    setDestinationError(false)
    setDestinationQuery(next)
  }

  function changeMode(nextMode: SearchMode) {
    if (nextMode === 'discover') setDiscoveryCapability('checking')
    setMode(nextMode)
  }

  function updateDestinationDraft(next: DestinationSearchCriteria) {
    setDestinationDraft(next)
    if (mode === 'discover') setDiscoveryCapability('checking')
  }

  function openDiscoveredRoute(destinationId: StationId) {
    const source = destinationQuery ?? destinationDraft
    const next: TrainSearchCriteria = {
      from: source.from,
      to: destinationId,
      date: source.date,
      bike: true,
    }
    setDraft(next)
    setMode('route')
    runSearch(next)
  }

  function swapDirection() {
    const next = { ...draft, from: draft.to, to: draft.from }
    setDraft(next)
    runSearch(next)
  }

  function resultsAnnouncement() {
    if (loading) return ro.loading
    if (error) return ro.errorTitle

    if (data?.meta.coverage === 'unsupported') return ro.coverageUnsupportedTitle
    if (data?.meta.coverage && data.meta.coverage !== 'covered') {
      return ro.coverageUnavailableTitle
    }

    const count = ro.resultsCount(data?.options.length ?? 0)
    if (data?.meta.warning) return `${count} ${data.meta.warning}`
    if (data?.meta.reliability === 'fallback') return `${count} ${ro.announcedFallback}`
    if (data?.meta.degraded) return `${count} ${ro.announcedCached}`
    return count
  }

  function destinationAnnouncement() {
    if (destinationLoading) return ro.loadingDestinations
    if (destinationError) return ro.destinationErrorTitle
    if (!destinationData) return ro.destinationStartBody
    if (destinationData.meta.coverage === 'unsupported') return ro.discoveryUnavailableTitle
    if (destinationData.meta.coverage && destinationData.meta.coverage !== 'covered') {
      return ro.coverageUnavailableTitle
    }
    return ro.destinationCount(destinationData.options.length)
  }

  const routeCoverage = data?.meta.coverage ?? 'covered'
  const routeUnsupported = routeCoverage === 'unsupported'
  const routeUnavailable = routeCoverage !== 'covered' && !routeUnsupported
  const destinationCoverage = destinationData?.meta.coverage ?? 'covered'
  const destinationUnsupported = destinationCoverage === 'unsupported'
  const destinationUnavailable = destinationCoverage !== 'covered' && !destinationUnsupported

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main">{ro.skipToContent}</a>
      <header className="site-header">
        <div className="header-inner">
          <a href="#main" className="brand" aria-label={`${ro.brand} — ${ro.homeLabel}`}>
            <BrandMark />
            <span>{ro.brand}</span>
          </a>
          <nav aria-label={ro.mainNavigation}>
            <a href="#cum-functioneaza">{ro.howItWorks}</a>
            <span className="pilot-pill">{ro.pilot}</span>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="search-shell" aria-label={ro.searchModesLabel}>
          <SearchModeTabs activeMode={mode} onChange={changeMode} />
          {mode === 'route' ? (
            <SearchPanel
              criteria={draft}
              loading={loading}
              onChange={setDraft}
              onSearch={() => runSearch({ ...draft })}
              onSwap={swapDirection}
            />
          ) : (
            <DestinationSearchPanel
              criteria={destinationDraft}
              loading={destinationLoading}
              disabled={discoveryCapability !== 'available'}
              onChange={updateDestinationDraft}
              onSearch={() => runDestinationSearch({ ...destinationDraft })}
            />
          )}
        </section>

        {mode === 'route' ? (
          <>
            <RouteLine stationIds={[query.from, query.to]} />

            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {resultsAnnouncement()}
            </p>

            <section className="results-section" aria-labelledby="results-title" aria-busy={loading}>
          <div className="results-heading">
            <div>
              <p className="eyebrow">{ro.compatibleResults}</p>
              <h2 id="results-title" ref={resultsTitleRef} tabIndex={-1}>{ro.resultsTitle}</h2>
              <p>{ro.resultsHint}</p>
            </div>
            {data && routeCoverage === 'covered' ? (
              <span className={`data-state ${data.meta.reliability}`}>
                {data.meta.reliability === 'fallback' ? <Info size={16} /> : <CheckCircle2 size={16} />}
                {data.meta.reliability === 'fallback'
                  ? ro.fallbackVerified
                  : data.meta.degraded
                    ? ro.cachedOfficialData
                    : ro.currentOfficialData}
              </span>
            ) : null}
          </div>

          {data?.meta.warning ? (
            <div className="source-warning">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{data.meta.warning}</span>
            </div>
          ) : null}

          {loading ? (
            <div className="state-panel loading-state">
              <span className="spinner" aria-hidden="true" />
              <span>{ro.loading}</span>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="state-panel">
              <AlertTriangle size={28} aria-hidden="true" />
              <h3>{ro.errorTitle}</h3>
              <p>{ro.errorBody}</p>
              <button type="button" className="secondary-button" onClick={() => runSearch({ ...query })}>
                <RefreshCw size={17} />{ro.retry}
              </button>
            </div>
          ) : null}

          {!loading && !error && routeUnsupported ? (
            <div className="state-panel coverage-state">
              <Compass size={30} aria-hidden="true" />
              <h3>{ro.coverageUnsupportedTitle}</h3>
              <p>{ro.coverageUnsupportedBody}</p>
            </div>
          ) : null}

          {!loading && !error && routeUnavailable ? (
            <div className="state-panel coverage-state">
              <AlertTriangle size={28} aria-hidden="true" />
              <h3>{ro.coverageUnavailableTitle}</h3>
              <p>{ro.coverageUnavailableBody}</p>
              <button type="button" className="secondary-button" onClick={() => runSearch({ ...query })}>
                <RefreshCw size={17} />{ro.retry}
              </button>
            </div>
          ) : null}

          {!loading && !error && routeCoverage === 'covered' && data?.options.length === 0 ? (
            <div className="state-panel">
              <Bike size={30} aria-hidden="true" />
              <h3>{ro.empty}</h3>
            </div>
          ) : null}

          {!loading && !error && routeCoverage === 'covered' && data?.options.map((train) => (
            <TrainCard train={train} key={train.id} />
          ))}
            </section>
          </>
        ) : (
          <>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {destinationAnnouncement()}
          </p>
          <section className="results-section destination-results" aria-labelledby="destination-results-title" aria-busy={destinationLoading}>
            <div className="results-heading">
              <div>
                <p className="eyebrow">{ro.directIdeas}</p>
                <h2
                  id="destination-results-title"
                  ref={destinationResultsTitleRef}
                  tabIndex={-1}
                >
                  {ro.destinationResultsTitle}
                </h2>
                <p>{ro.destinationResultsHint}</p>
              </div>
              {destinationData && destinationCoverage === 'covered' ? (
                <span className={`data-state ${destinationData.meta.reliability}`}>
                  {destinationData.meta.reliability === 'fallback' ? <Info size={16} /> : <CheckCircle2 size={16} />}
                  {destinationData.meta.reliability === 'fallback'
                    ? ro.fallbackVerified
                    : destinationData.meta.degraded
                      ? ro.cachedOfficialData
                      : ro.currentOfficialData}
                </span>
              ) : null}
            </div>

            {destinationData?.meta.warning ? (
              <div className="source-warning">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{destinationData.meta.warning}</span>
              </div>
            ) : null}

            {!destinationQuery && !destinationLoading && discoveryCapability === 'available' ? (
              <div className="state-panel destination-start-state">
                <Compass size={32} aria-hidden="true" />
                <h3>{ro.destinationStartTitle}</h3>
                <p>{ro.destinationStartBody}</p>
              </div>
            ) : null}

            {!destinationQuery && !destinationLoading && discoveryCapability === 'checking' ? (
              <div className="state-panel loading-state">
                <span className="spinner" aria-hidden="true" />
                <span>{ro.loadingDestinations}</span>
              </div>
            ) : null}

            {!destinationQuery && !destinationLoading && discoveryCapability === 'unsupported' ? (
              <div className="state-panel coverage-state">
                <Compass size={30} aria-hidden="true" />
                <h3>{ro.discoveryUnavailableTitle}</h3>
                <p>{ro.discoveryUnavailableBody}</p>
              </div>
            ) : null}

            {!destinationQuery && !destinationLoading && discoveryCapability === 'unavailable' ? (
              <div className="state-panel coverage-state">
                <AlertTriangle size={28} aria-hidden="true" />
                <h3>{ro.coverageUnavailableTitle}</h3>
                <p>{ro.coverageUnavailableBody}</p>
              </div>
            ) : null}

            {destinationLoading ? (
              <div className="state-panel loading-state">
                <span className="spinner" aria-hidden="true" />
                <span>{ro.loadingDestinations}</span>
              </div>
            ) : null}

            {!destinationLoading && destinationError ? (
              <div className="state-panel">
                <AlertTriangle size={28} aria-hidden="true" />
                <h3>{ro.destinationErrorTitle}</h3>
                <p>{ro.destinationErrorBody}</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => runDestinationSearch({ ...(destinationQuery ?? destinationDraft) })}
                >
                  <RefreshCw size={17} />{ro.retry}
                </button>
              </div>
            ) : null}

            {!destinationLoading && !destinationError && destinationUnsupported ? (
              <div className="state-panel coverage-state">
                <Compass size={30} aria-hidden="true" />
                <h3>{ro.discoveryUnavailableTitle}</h3>
                <p>{ro.discoveryUnavailableBody}</p>
              </div>
            ) : null}

            {!destinationLoading && !destinationError && destinationUnavailable ? (
              <div className="state-panel coverage-state">
                <AlertTriangle size={28} aria-hidden="true" />
                <h3>{ro.coverageUnavailableTitle}</h3>
                <p>{ro.coverageUnavailableBody}</p>
              </div>
            ) : null}

            {!destinationLoading && !destinationError && destinationCoverage === 'covered' && destinationData?.options.length === 0 ? (
              <div className="state-panel">
                <Bike size={30} aria-hidden="true" />
                <h3>{ro.noDirectDestinations}</h3>
                <p>{ro.noDirectDestinationsHint}</p>
              </div>
            ) : null}

            {!destinationLoading && !destinationError && destinationCoverage === 'covered' && destinationData?.options.map((option) => (
              <DestinationCard
                key={option.destinationStationId}
                option={option}
                originId={destinationQuery?.from ?? destinationDraft.from}
                onOpenRoute={openDiscoveredRoute}
              />
            ))}
          </section>
          </>
        )}

        <section className="how-it-works" id="cum-functioneaza" aria-labelledby="how-title">
          <div>
            <p className="eyebrow">{ro.ruleEyebrow}</p>
            <h2 id="how-title">{ro.ruleTitle}</h2>
          </div>
          <p>
            {ro.ruleBody}
          </p>
        </section>
      </main>

      <footer>
        <div>
          <BrandMark />
          <p><strong>{ro.brand}</strong><br />{ro.independentTool}</p>
        </div>
        <p>{ro.ticketDisclaimer}</p>
      </footer>
    </div>
  )
}
