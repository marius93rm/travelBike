import { AlertTriangle, Bike, CalendarDays, CheckCircle2, Clock3, Compass, History, Info, RefreshCw, Search, Share2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchCoverage, fetchDestinations, fetchTrains } from '../data/train-api.js'
import {
  formatJourneyDate,
  journeyDateBounds,
  millisecondsUntilNextRomaniaMidnight,
} from '../domain/journey-date.js'
import { stationCatalogMeta, stationsById } from '../domain/stations.js'
import type {
  DestinationSearchCriteria,
  DestinationSearchResponse,
  StationId,
  TrainSearchMeta,
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
import { SearchCriteriaSummary } from './components/SearchCriteriaSummary.js'
import { SearchFreshness } from './components/SearchFreshness.js'
import { SearchSourceAttribution } from './components/SearchSourceAttribution.js'
import { ProviderSearchLinks } from './components/ProviderSearchLinks.js'
import { TrainCard } from './components/TrainCard.js'
import { filterDepartures, type DepartureTimeFilter } from './departure-filter.js'
import {
  createEmptyRouteDraft,
  parseRouteCriteria,
  routeCriteriaSearch,
  type RouteDraftCriteria,
} from './route-criteria.js'

function createInitialDestinationCriteria(date: string): DestinationSearchCriteria {
  return { from: 'brasov', date, bike: true, direct: true }
}

function routeSearchKey(criteria: Pick<TrainSearchCriteria, 'from' | 'to' | 'date'>) {
  return `${criteria.from}|${criteria.to}|${criteria.date}`
}

function sourceReliabilityLabel(meta: TrainSearchMeta) {
  if (meta.reliability === 'fallback') return ro.fallbackVerified
  if (meta.reliability) return ro.officialSource
  return ro.sourceReliabilityUnknown
}

function freshnessLabel(meta: TrainSearchMeta) {
  if (meta.cacheStatus === 'live') return ro.liveSourceResponse
  if (meta.cacheStatus === 'cached') return ro.cachedData
  if (meta.cacheStatus === 'mixed') return ro.mixedDataSources
  return ro.freshnessStateUnknown
}

function freshnessNotice(meta: TrainSearchMeta) {
  if (meta.cacheStatus === 'cached') return ro.announcedCached
  if (meta.cacheStatus === 'mixed') return ro.announcedMixedCache
  if (meta.cacheStatus === undefined) return ro.announcedCacheUnknown
  return ''
}

function SearchDataStatus({ meta }: { meta: TrainSearchMeta }) {
  return (
    <>
      <span className={`data-state ${meta.reliability ?? 'unknown'}`}>
        {meta.reliability === 'official' || meta.reliability === 'open_data'
          ? <CheckCircle2 size={16} aria-hidden="true" />
          : <Info size={16} aria-hidden="true" />}
        {sourceReliabilityLabel(meta)}
      </span>
      <span className={`data-state cache-${meta.cacheStatus ?? 'unknown'}`}>
        {meta.cacheStatus === 'live'
          ? <CheckCircle2 size={16} aria-hidden="true" />
          : <Info size={16} aria-hidden="true" />}
        {freshnessLabel(meta)}
      </span>
    </>
  )
}

export function App() {
  const [now, setNow] = useState(() => new Date())
  const dateBounds = journeyDateBounds(now)
  const catalogExpired = dateBounds.catalogExpired
  const catalogExpiredMessage = ro.catalogExpiredBody(
    formatJourneyDate(dateBounds.catalogValidUntil),
  )
  const [initialQuery] = useState(() => parseRouteCriteria(window.location.search, now))
  const [mode, setMode] = useState<SearchMode>('route')
  const [draft, setDraft] = useState<RouteDraftCriteria>(
    () => initialQuery ?? createEmptyRouteDraft(dateBounds.min),
  )
  const [query, setQuery] = useState<TrainSearchCriteria | null>(initialQuery)
  const [recentSearches, setRecentSearches] = useState<TrainSearchCriteria[]>(
    () => initialQuery ? [initialQuery] : [],
  )
  const visibleRecentSearches = useMemo(
    () => recentSearches
      .filter((recent) => !query || routeSearchKey(recent) !== routeSearchKey(query))
      .slice(0, query ? 3 : 4),
    [query, recentSearches],
  )
  const [data, setData] = useState<TrainSearchResponse | null>(null)
  const [departureTimeFilter, setDepartureTimeFilter] = useState<DepartureTimeFilter>('all')
  const visibleTrains = useMemo(
    () => data ? filterDepartures(data.options, departureTimeFilter) : [],
    [data, departureTimeFilter],
  )
  const routeDisabled = data?.meta.providerStatus === 'disabled'
  const [loading, setLoading] = useState(Boolean(initialQuery) && !catalogExpired)
  const [error, setError] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const [shareFallbackUrl, setShareFallbackUrl] = useState('')
  const [destinationDraft, setDestinationDraft] = useState(
    () => createInitialDestinationCriteria(dateBounds.min),
  )
  const [destinationQuery, setDestinationQuery] = useState<DestinationSearchCriteria | null>(null)
  const destinationQueryDate = destinationQuery?.date
  const [destinationData, setDestinationData] = useState<DestinationSearchResponse | null>(null)
  const [destinationLoading, setDestinationLoading] = useState(false)
  const [destinationError, setDestinationError] = useState(false)
  const [discoveryCapability, setDiscoveryCapability] = useState<
    'unknown' | 'checking' | 'available' | 'unsupported' | 'unavailable'
  >('unknown')
  const [checkedDiscoveryCriteriaKey, setCheckedDiscoveryCriteriaKey] = useState('')
  const [discoveryCapabilityAttempt, setDiscoveryCapabilityAttempt] = useState(0)
  const discoveryDateRef = useRef<HTMLInputElement>(null)
  const resultsTitleRef = useRef<HTMLHeadingElement>(null)
  const destinationResultsTitleRef = useRef<HTMLHeadingElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const focusResultsAfterSearch = useRef(false)
  const focusDestinationsAfterSearch = useRef(false)
  const focusRouteDestinationAfterModeChange = useRef(false)
  const trainSearchSequence = useRef(0)
  const destinationSearchSequence = useRef(0)
  const discoveryCapabilitySequence = useRef(0)
  const discoveryDraftTouched = useRef(false)

  useEffect(() => {
    const timeout = window.setTimeout(
      () => {
        const nextNow = new Date()
        const nextBounds = journeyDateBounds(nextNow)
        setNow(nextNow)
        if (nextBounds.catalogExpired) {
          setMode('route')
          return
        }

        setDraft((current) => current.date < nextBounds.min
          ? { ...current, date: nextBounds.min }
          : current)
        setDestinationDraft((current) => current.date < nextBounds.min
          ? { ...current, date: nextBounds.min }
          : current)

        if (query && query.date < nextBounds.min) {
          setLoading(true)
          setError(false)
          const nextQuery = { ...query, date: nextBounds.min }
          window.history.replaceState(null, '', routeCriteriaSearch(nextQuery))
          setQuery(nextQuery)
        }

        if (destinationQueryDate && destinationQueryDate < nextBounds.min) {
          setDestinationLoading(true)
          setDestinationError(false)
          setDestinationQuery((current) => current && current.date < nextBounds.min
            ? { ...current, date: nextBounds.min }
            : current)
        }
      },
      millisecondsUntilNextRomaniaMidnight(now),
    )
    return () => window.clearTimeout(timeout)
  }, [now, query, destinationQueryDate])

  useEffect(() => {
    if (catalogExpired || !query) return
    const controller = new AbortController()
    const requestSequence = trainSearchSequence.current
    let active = true

    fetchTrains(query, controller.signal)
      .then((response) => {
        if (active && requestSequence === trainSearchSequence.current) setData(response)
      })
      .catch((requestError: unknown) => {
        if (!active || requestSequence !== trainSearchSequence.current) return
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(true)
        setData(null)
      })
      .finally(() => {
        if (active && requestSequence === trainSearchSequence.current) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [query, catalogExpired])

  useEffect(() => {
    const syncRouteFromHistory = () => {
      const next = parseRouteCriteria(window.location.search)
      trainSearchSequence.current += 1
      setDraft(next ?? createEmptyRouteDraft(journeyDateBounds().min))
      setQuery(next)
      setData(null)
      setError(false)
      setLoading(Boolean(next) && !journeyDateBounds().catalogExpired)
      setDepartureTimeFilter('all')
      setShareStatus('')
      setShareFallbackUrl('')
      setMode('route')
    }
    window.addEventListener('popstate', syncRouteFromHistory)
    return () => window.removeEventListener('popstate', syncRouteFromHistory)
  }, [])

  useEffect(() => {
    if (catalogExpired) return
    if (!destinationQuery) return
    const controller = new AbortController()
    const requestSequence = destinationSearchSequence.current
    let active = true

    fetchDestinations(destinationQuery, controller.signal)
      .then((response) => {
        if (active && requestSequence === destinationSearchSequence.current) {
          setDestinationData(response)
        }
      })
      .catch((requestError: unknown) => {
        if (!active || requestSequence !== destinationSearchSequence.current) return
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setDestinationError(true)
        setDestinationData(null)
      })
      .finally(() => {
        if (active && requestSequence === destinationSearchSequence.current) {
          setDestinationLoading(false)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [destinationQuery, catalogExpired])

  const discoveryCriteria = useMemo(
    () => mode === 'discover' ? destinationDraft : draft,
    [mode, destinationDraft, draft],
  )
  const discoveryCriteriaKey = discoveryCriteria.from
    ? `${discoveryCriteria.from}\u0000${discoveryCriteria.date}`
    : ''
  const discoveryFrom = discoveryCriteria.from
  const discoveryDate = discoveryCriteria.date
  const currentDiscoveryCapability = checkedDiscoveryCriteriaKey === discoveryCriteriaKey
    ? discoveryCapability
    : discoveryCriteriaKey ? 'checking' : 'unknown'

  useEffect(() => {
    if (catalogExpired || !discoveryFrom) return
    const controller = new AbortController()
    const requestSequence = ++discoveryCapabilitySequence.current
    let active = true
    fetchCoverage({ from: discoveryFrom, date: discoveryDate }, controller.signal)
      .then((coverage) => {
        if (!active || requestSequence !== discoveryCapabilitySequence.current) return
        setCheckedDiscoveryCriteriaKey(discoveryCriteriaKey)
        if (coverage.discovery.coverage === 'available') {
          setDiscoveryCapability('available')
        } else if (coverage.discovery.coverage === 'unsupported') {
          setDiscoveryCapability('unsupported')
          setMode('route')
        } else {
          setDiscoveryCapability('unavailable')
        }
      })
      .catch((requestError: unknown) => {
        if (!active || requestSequence !== discoveryCapabilitySequence.current) return
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setDiscoveryCapability('unavailable')
        setCheckedDiscoveryCriteriaKey(discoveryCriteriaKey)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [
    discoveryFrom,
    discoveryDate,
    catalogExpired,
    discoveryCapabilityAttempt,
    discoveryCriteriaKey,
  ])

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

  useEffect(() => {
    if (mode !== 'route' || !focusRouteDestinationAfterModeChange.current) return
    focusRouteDestinationAfterModeChange.current = false
    document.getElementById('to-station')?.focus()
  }, [mode])

  function runSearch(next: TrainSearchCriteria) {
    if (catalogExpired) return
    setRecentSearches((current) => [
      next,
      ...current.filter((recent) => routeSearchKey(recent) !== routeSearchKey(next)),
    ].slice(0, 4))
    trainSearchSequence.current += 1
    focusResultsAfterSearch.current = true
    setLoading(true)
    setError(false)
    setData(null)
    setDepartureTimeFilter('all')
    setDraft(next)
    setShareStatus('')
    setShareFallbackUrl('')
    window.history.pushState(null, '', routeCriteriaSearch(next))
    setQuery(next)
  }

  async function shareRoute() {
    if (!query) return
    setShareStatus('')
    setShareFallbackUrl('')
    const shareUrl = new URL(window.location.href)
    shareUrl.search = routeCriteriaSearch(query)
    shareUrl.hash = ''
    const url = shareUrl.toString()
    const from = stationsById.get(query.from)?.name ?? query.from
    const to = stationsById.get(query.to)?.name ?? query.to

    try {
      if (navigator.share) {
        await navigator.share({
          title: ro.shareTitle,
          text: ro.shareDescription(from, to, formatJourneyDate(query.date)),
          url,
        })
        setShareStatus(ro.shareComplete)
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setShareStatus(ro.shareCopied)
      } else {
        setShareFallbackUrl(url)
        setShareStatus(ro.shareFallback)
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return
      setShareFallbackUrl(url)
      setShareStatus(ro.shareFallback)
    }
  }

  function runDestinationSearch(next: DestinationSearchCriteria) {
    if (catalogExpired || currentDiscoveryCapability !== 'available') return
    discoveryDraftTouched.current = true
    destinationSearchSequence.current += 1
    focusDestinationsAfterSearch.current = true
    setDestinationLoading(true)
    setDestinationError(false)
    setDestinationQuery(next)
  }

  function changeMode(nextMode: SearchMode) {
    discoveryCapabilitySequence.current += 1
    if (nextMode === 'discover' && !catalogExpired) {
      if (!discoveryDraftTouched.current) {
        if (draft.from) {
          setDestinationDraft((current) => ({ ...current, from: draft.from, date: draft.date }))
        }
      }
    }
    setMode(nextMode)
  }

  function updateDestinationDraft(next: DestinationSearchCriteria) {
    discoveryCapabilitySequence.current += 1
    discoveryDraftTouched.current = true
    if (next.from !== destinationDraft.from || next.date !== destinationDraft.date) {
      destinationSearchSequence.current += 1
      focusDestinationsAfterSearch.current = false
      setDestinationQuery(null)
      setDestinationData(null)
      setDestinationLoading(false)
      setDestinationError(false)
    }
    setDestinationDraft(next)
  }

  function retryDiscoveryCapability() {
    discoveryCapabilitySequence.current += 1
    setDiscoveryCapability('checking')
    setCheckedDiscoveryCriteriaKey('')
    setDiscoveryCapabilityAttempt((attempt) => attempt + 1)
  }

  function openDiscoveredRoute(destinationId: StationId) {
    discoveryCapabilitySequence.current += 1
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

  function openSpecificRouteSearch() {
    const source = destinationQuery ?? destinationDraft
    const next: RouteDraftCriteria = {
      ...draft,
      from: source.from,
      to: draft.to === source.from ? draft.from : draft.to,
      date: source.date,
      bike: true,
    }
    focusRouteDestinationAfterModeChange.current = true
    setDraft(next)
    changeMode('route')
  }

  function swapDirection() {
    const next: RouteDraftCriteria = { ...draft, from: draft.to, to: draft.from }
    setDraft(next)
    if (next.from && next.to) runSearch({ ...next, from: next.from, to: next.to })
  }

  function resultsAnnouncement() {
    if (!query) return ''
    if (catalogExpired) return `${ro.catalogExpiredTitle} ${catalogExpiredMessage}`
    if (loading) return ro.loading
    if (error) return ro.errorTitle
    if (data?.meta.providerStatus === 'disabled') {
      const hasOperatorSearchLink = data.meta.sources?.some((source) => (
        source.outcome !== 'success' && Boolean(source.searchUrl && source.sourceInfo)
      ))
      const fromName = stationsById.get(query.from)?.name ?? query.from
      const toName = stationsById.get(query.to)?.name ?? query.to
      const linkAnnouncement = hasOperatorSearchLink
        ? ro.operatorSearchLinkReady(fromName, toName, formatJourneyDate(query.date))
        : undefined
      return [linkAnnouncement, ro.liveSearchDisabledTitle, ro.liveSearchDisabledBody]
        .filter(Boolean)
        .join(' ')
    }

    if (data?.meta.coverage === 'unsupported') return ro.coverageUnsupportedTitle
    if (data?.meta.coverage && data.meta.coverage !== 'covered') {
      return ro.coverageUnavailableTitle
    }
    const summary = data && data.options.length === 0
      ? ro.empty
      : data && departureTimeFilter !== 'all'
        ? visibleTrains.length === 0
          ? ro.noDeparturesFrom(departureTimeFilter)
          : ro.filteredResultsCount(visibleTrains.length, data.options.length)
        : ro.resultsCount(data?.options.length ?? 0)
    const notice = data ? freshnessNotice(data.meta) : ''
    if (data?.meta.warning) return [summary, data.meta.warning, notice].filter(Boolean).join(' ')
    if (data?.meta.reliability === 'fallback') {
      return [summary, ro.announcedFallback, notice].filter(Boolean).join(' ')
    }
    if (notice) return `${summary} ${notice}`
    return summary
  }

  function destinationAnnouncement() {
    if (catalogExpired) return `${ro.catalogExpiredTitle} ${catalogExpiredMessage}`
    if (destinationLoading) return ro.loadingDestinations
    if (destinationError) return ro.destinationErrorTitle
    if (!destinationData) {
      if (currentDiscoveryCapability === 'checking') return ro.loadingDestinations
      if (currentDiscoveryCapability === 'unsupported') return ro.discoveryUnavailableTitle
      if (currentDiscoveryCapability === 'unavailable') return ro.coverageUnavailableTitle
      return ro.destinationStartBody
    }
    if (destinationData.meta.coverage === 'unsupported') return ro.discoveryUnavailableTitle
    if (destinationData.meta.coverage && destinationData.meta.coverage !== 'covered') {
      return ro.coverageUnavailableTitle
    }
    const summary = destinationData.options.length === 0
      ? `${ro.noDirectDestinations} ${ro.noDirectDestinationsHint}`
      : ro.destinationCount(destinationData.options.length)
    const notice = freshnessNotice(destinationData.meta)
    if (destinationData.meta.warning) {
      return [summary, destinationData.meta.warning, notice].filter(Boolean).join(' ')
    }
    if (destinationData.meta.reliability === 'fallback') {
      return [summary, ro.announcedFallback, notice].filter(Boolean).join(' ')
    }
    if (notice) return `${summary} ${notice}`
    return summary
  }

  const routeCoverage = data?.meta.coverage ?? 'covered'
  const routeUnsupported = routeCoverage === 'unsupported'
  const routeUnavailable = routeCoverage !== 'covered' && !routeUnsupported && !routeDisabled
  const destinationCoverage = destinationData?.meta.coverage ?? 'covered'
  const destinationUnsupported = destinationCoverage === 'unsupported'
  const destinationUnavailable = destinationCoverage !== 'covered' && !destinationUnsupported
  const discoveryActionReason = catalogExpired
    ? undefined
    : destinationLoading || currentDiscoveryCapability === 'checking'
      ? ro.loadingDestinations
      : currentDiscoveryCapability === 'unsupported'
        ? ro.discoveryUnavailableTitle
        : currentDiscoveryCapability === 'unavailable'
          ? ro.coverageUnavailableTitle
          : undefined
  const routeActionReason = catalogExpired
    ? undefined
    : loading
      ? ro.loading
      : routeDisabled
        ? ro.liveSearchDisabledBody
        : undefined
  const showDiscoveryTab = !catalogExpired
    && Boolean(discoveryCriteria.from)
    && (currentDiscoveryCapability === 'available'
      || currentDiscoveryCapability === 'unavailable'
      || mode === 'discover')

  return (
    <div className="app-frame">
      <a
        className="skip-link"
        href="#main"
        onClick={() => mainRef.current?.focus()}
      >
        {ro.skipToContent}
      </a>
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

      <main id="main" ref={mainRef} tabIndex={-1}>
        {dateBounds.catalogExpiringSoon && !catalogExpired ? (
          <div className="source-warning catalog-expiry-warning" role="note">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>
              <strong>{ro.catalogExpiringSoonTitle}</strong>{' '}
              {ro.catalogExpiringSoonBody(formatJourneyDate(dateBounds.catalogValidUntil))}
            </p>
          </div>
        ) : null}
        {catalogExpired && !query ? (
          <div className="source-warning catalog-expiry-warning" role="status">
            <AlertTriangle size={18} aria-hidden="true" />
            <p>
              <strong>{ro.catalogExpiredTitle}</strong>{' '}
              {catalogExpiredMessage}
            </p>
          </div>
        ) : null}
        <section className="search-shell" aria-label={ro.searchModesLabel}>
          <SearchModeTabs
            activeMode={mode}
            onChange={changeMode}
            showDiscovery={showDiscoveryTab}
          />
          <SearchPanel
            hidden={mode !== 'route'}
            criteria={draft}
            loading={loading}
            disabled={routeDisabled}
            disabledReason={routeActionReason}
            onChange={setDraft}
            onSearch={runSearch}
            onSwap={swapDirection}
          />
          <DestinationSearchPanel
            hidden={mode !== 'discover'}
            criteria={destinationDraft}
            dateInputRef={discoveryDateRef}
            loading={destinationLoading}
            disabled={currentDiscoveryCapability !== 'available'}
            disabledReason={discoveryActionReason}
            onChange={updateDestinationDraft}
            onSearch={() => runDestinationSearch({ ...destinationDraft })}
          />
        </section>

        {mode === 'route' && visibleRecentSearches.length > 0 ? (
          <section className="recent-searches" aria-labelledby="recent-searches-title">
            <div className="recent-searches-heading">
              <div>
                <p className="eyebrow">{ro.recentSearchesEyebrow}</p>
                <h2 id="recent-searches-title">
                  <History size={21} aria-hidden="true" />
                  {ro.recentSearchesTitle}
                </h2>
                <p>{ro.recentSearchesNote}</p>
              </div>
              <button
                type="button"
                className="recent-clear-button"
                onClick={() => {
                  setRecentSearches([])
                  document.getElementById('from-station')?.focus()
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                {ro.clearRecentSearches}
              </button>
            </div>
            <ul className="recent-search-list">
              {visibleRecentSearches.map((recent) => {
                const from = stationsById.get(recent.from)?.name ?? recent.from
                const to = stationsById.get(recent.to)?.name ?? recent.to
                const date = formatJourneyDate(recent.date)
                const key = routeSearchKey(recent)

                return (
                  <li className="recent-search-item" key={key}>
                    <button
                      type="button"
                      className="recent-route-button"
                      onClick={() => runSearch(recent)}
                      aria-label={ro.repeatRecentSearch(from, to, date)}
                    >
                      <span className="recent-route-stations">
                        {from} <span aria-hidden="true">→</span> {to}
                      </span>
                      <span className="recent-route-date">{date}</span>
                    </button>
                    <button
                      type="button"
                      className="recent-remove-button"
                      aria-label={ro.removeRecentSearch(from, to, date)}
                      onClick={(event) => {
                        const item = event.currentTarget.closest('li')
                        const focusTarget = item?.nextElementSibling?.querySelector('button')
                          ?? item?.previousElementSibling?.querySelector('button')
                        setRecentSearches((current) => current.filter((entry) => (
                          routeSearchKey(entry) !== key
                        )))
                        window.requestAnimationFrame(() => {
                          if (focusTarget instanceof HTMLButtonElement) focusTarget.focus()
                          else document.getElementById('from-station')?.focus()
                        })
                      }}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}

        {mode === 'route' ? query ? (
          <>
            <RouteLine stationIds={[query.from, query.to]} />

            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {resultsAnnouncement()}
            </p>

            <section
              className="results-section"
              aria-labelledby="results-title"
              aria-busy={loading && !catalogExpired}
            >
          <div className="results-heading">
            <div>
              <p className="eyebrow">{ro.compatibleResults}</p>
              <h2 id="results-title" ref={resultsTitleRef} tabIndex={-1}>{ro.resultsTitle}</h2>
              <p>{ro.resultsHint}</p>
              <SearchCriteriaSummary from={query.from} to={query.to} date={query.date} />
            </div>
            <div className="results-heading-actions">
              {data && !catalogExpired && !loading && routeCoverage === 'covered'
                && (data.meta.reliability != null || data.meta.asOf) ? (
                <div className="results-data-meta">
                  <SearchDataStatus meta={data.meta} />
                  {data.options.length === 0 ? (
                    <SearchSourceAttribution sources={data.meta.sources} />
                  ) : null}
                  <SearchFreshness asOf={data.meta.asOf} />
                </div>
              ) : null}
              <div className="share-search">
                <button type="button" className="secondary-button" onClick={shareRoute}>
                  <Share2 size={17} aria-hidden="true" />
                  {ro.shareRoute}
                </button>
                {shareStatus ? (
                  <p role="status" aria-live="polite" aria-atomic="true">{shareStatus}</p>
                ) : null}
                {shareFallbackUrl ? (
                  <label className="share-fallback">
                    {ro.shareLinkLabel}
                    <input type="url" readOnly value={shareFallbackUrl} onFocus={(event) => event.currentTarget.select()} />
                  </label>
                ) : null}
              </div>
            </div>
          </div>

          {catalogExpired ? (
            <div className="state-panel coverage-state">
              <AlertTriangle size={28} aria-hidden="true" />
              <h3>{ro.catalogExpiredTitle}</h3>
              <p>{catalogExpiredMessage}</p>
            </div>
          ) : (
            <>
          {!loading && !routeDisabled && !routeUnsupported && data?.meta.warning ? (
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

          {!loading && !error && routeDisabled ? (
            <div className="state-panel coverage-state">
              <Info size={28} aria-hidden="true" />
              <h3>{ro.liveSearchDisabledTitle}</h3>
              <p>{ro.liveSearchDisabledBody}</p>
              <ProviderSearchLinks sources={data?.meta.sources} />
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
              <ProviderSearchLinks sources={data?.meta.sources} />
            </div>
          ) : null}

          {!loading && !error && routeCoverage === 'covered' && (data?.options.length ?? 0) > 1 ? (
            <div className="results-filter-toolbar">
              <div className="results-filter">
                <label htmlFor="departure-time-filter">{ro.departureTimeFilterLabel}</label>
                <select
                  id="departure-time-filter"
                  value={departureTimeFilter}
                  onChange={(event) => setDepartureTimeFilter(event.currentTarget.value as DepartureTimeFilter)}
                >
                  <option value="all">{ro.departureTimeFilterAll}</option>
                  <option value="10">{ro.departureTimeFilterFrom('10:00')}</option>
                  <option value="14">{ro.departureTimeFilterFrom('14:00')}</option>
                  <option value="18">{ro.departureTimeFilterFrom('18:00')}</option>
                </select>
              </div>
              {departureTimeFilter !== 'all' && visibleTrains.length > 0 ? (
                <p className="filtered-results-count">
                  {ro.filteredResultsCount(visibleTrains.length, data?.options.length ?? 0)}
                </p>
              ) : null}
            </div>
          ) : null}

          {!loading && !error && routeCoverage === 'covered' && data?.options.length === 0 ? (
            <div className="state-panel">
              <Bike size={30} aria-hidden="true" />
              <h3>{ro.empty}</h3>
            </div>
          ) : null}

          {!loading && !error && routeCoverage === 'covered' && data && data.options.length > 0 && visibleTrains.length === 0 ? (
            <div className="state-panel time-filter-empty">
              <Clock3 size={30} aria-hidden="true" />
              <h3>{ro.noDeparturesFrom(departureTimeFilter)}</h3>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setDepartureTimeFilter('all')
                  document.getElementById('departure-time-filter')?.focus()
                }}
              >
                {ro.showAllDepartures}
              </button>
            </div>
          ) : null}

          {!loading && !error && routeCoverage === 'covered' && visibleTrains.map((train) => (
            <TrainCard train={train} key={train.id} />
          ))}
            </>
          )}
            </section>
          </>
        ) : (
          <section className="route-start-state" aria-labelledby="route-start-title">
            <div className="route-start-mark"><Bike size={24} aria-hidden="true" /></div>
            <div>
              <h2 id="route-start-title">{ro.routeStartTitle}</h2>
              <p>{ro.routeStartBody}</p>
            </div>
          </section>
        ) : (
          <>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {destinationAnnouncement()}
          </p>
          <section
            className="results-section destination-results"
            aria-labelledby="destination-results-title"
            aria-busy={destinationLoading && !catalogExpired}
          >
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
                {destinationQuery && !catalogExpired ? (
                  <SearchCriteriaSummary
                    from={destinationQuery.from}
                    date={destinationQuery.date}
                  />
                ) : null}
              </div>
              {destinationData && !catalogExpired && !destinationLoading
                && destinationCoverage === 'covered'
                && (destinationData.meta.reliability != null || destinationData.meta.asOf) ? (
                <div className="results-data-meta">
                  <SearchDataStatus meta={destinationData.meta} />
                  {destinationData.options.length === 0 ? (
                    <SearchSourceAttribution sources={destinationData.meta.sources} />
                  ) : null}
                  <SearchFreshness asOf={destinationData.meta.asOf} />
                </div>
              ) : null}
            </div>

            {catalogExpired ? (
              <div className="state-panel coverage-state">
                <AlertTriangle size={28} aria-hidden="true" />
                <h3>{ro.catalogExpiredTitle}</h3>
                <p>{catalogExpiredMessage}</p>
              </div>
            ) : (
              <>
            {!destinationLoading && !destinationUnsupported && destinationData?.meta.warning ? (
              <div className="source-warning">
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{destinationData.meta.warning}</span>
              </div>
            ) : null}

            {!destinationQuery && !destinationLoading && currentDiscoveryCapability === 'available' ? (
              <div className="state-panel destination-start-state">
                <Compass size={32} aria-hidden="true" />
                <h3>{ro.destinationStartTitle}</h3>
                <p>{ro.destinationStartBody}</p>
              </div>
            ) : null}

            {!destinationQuery && !destinationLoading && currentDiscoveryCapability === 'checking' ? (
              <div className="state-panel loading-state">
                <span className="spinner" aria-hidden="true" />
                <span>{ro.loadingDestinations}</span>
              </div>
            ) : null}

            {!destinationQuery && !destinationLoading && currentDiscoveryCapability === 'unsupported' ? (
              <div className="state-panel coverage-state">
                <Compass size={30} aria-hidden="true" />
                <h3>{ro.discoveryUnavailableTitle}</h3>
                <p>{ro.discoveryUnavailableBody}</p>
                <button type="button" className="secondary-button" onClick={openSpecificRouteSearch}>
                  <Search size={17} aria-hidden="true" />{ro.searchSpecificRoute}
                </button>
              </div>
            ) : null}

            {!destinationQuery && !destinationLoading && currentDiscoveryCapability === 'unavailable' ? (
              <div className="state-panel coverage-state">
                <AlertTriangle size={28} aria-hidden="true" />
                <h3>{ro.coverageUnavailableTitle}</h3>
                <p>{ro.coverageUnavailableBody}</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={retryDiscoveryCapability}
                >
                  <RefreshCw size={17} />{ro.retry}
                </button>
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
                <button type="button" className="secondary-button" onClick={openSpecificRouteSearch}>
                  <Search size={17} aria-hidden="true" />{ro.searchSpecificRoute}
                </button>
              </div>
            ) : null}

            {!destinationLoading && !destinationError && destinationUnavailable ? (
              <div className="state-panel coverage-state">
                <AlertTriangle size={28} aria-hidden="true" />
                <h3>{ro.coverageUnavailableTitle}</h3>
                <p>{ro.coverageUnavailableBody}</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => runDestinationSearch({ ...(destinationQuery ?? destinationDraft) })}
                >
                  <RefreshCw size={17} />{ro.retry}
                </button>
              </div>
            ) : null}

            {!destinationLoading && !destinationError && destinationCoverage === 'covered' && destinationData?.options.length === 0 ? (
              <div className="state-panel">
                <Bike size={30} aria-hidden="true" />
                <h3>{ro.noDirectDestinations}</h3>
                <p>{ro.noDirectDestinationsHint}</p>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={catalogExpired}
                  onClick={() => discoveryDateRef.current?.focus()}
                >
                  <CalendarDays size={17} aria-hidden="true" />{ro.chooseAnotherDate}
                </button>
                <button type="button" className="secondary-button" onClick={openSpecificRouteSearch}>
                  <Search size={17} aria-hidden="true" />{ro.searchSpecificRoute}
                </button>
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
              </>
            )}
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
        <p className="catalog-attribution">
          {ro.stationCatalogLabel}{' '}
          <a href={stationCatalogMeta.sourceUrl}>{ro.stationCatalogSource}</a>
          {' · '}{ro.stationCatalogExportDate(formatJourneyDate(stationCatalogMeta.exportedAt))}
          {' · '}{ro.stationCatalogValidUntil(formatJourneyDate(stationCatalogMeta.validUntil))}
          {' · '}{ro.stationCatalogLicenseLead}{' '}
          <a href={ro.stationCatalogLicenseUrl}>{ro.stationCatalogLicense}</a>.
        </p>
        <p>{ro.ticketDisclaimer}</p>
      </footer>
    </div>
  )
}
