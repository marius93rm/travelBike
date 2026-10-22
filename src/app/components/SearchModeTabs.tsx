import { MapPinned, Search } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { ro } from '../../i18n/ro.js'

export type SearchMode = 'route' | 'discover'

interface SearchModeTabsProps {
  activeMode: SearchMode
  onChange: (mode: SearchMode) => void
  showDiscovery?: boolean
}

export function SearchModeTabs({
  activeMode,
  onChange,
  showDiscovery = true,
}: SearchModeTabsProps) {
  const routeTabRef = useRef<HTMLButtonElement>(null)
  const discoverTabRef = useRef<HTMLButtonElement>(null)
  const previousModeRef = useRef(activeMode)

  useEffect(() => {
    if (previousModeRef.current === 'discover' && activeMode === 'route' && !showDiscovery) {
      routeTabRef.current?.focus()
    }
    previousModeRef.current = activeMode
  }, [activeMode, showDiscovery])

  function selectMode(mode: SearchMode) {
    if (mode === 'discover' && !showDiscovery) return
    onChange(mode)
    if (mode === 'route') routeTabRef.current?.focus()
    else discoverTabRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      if (!showDiscovery) return
      const nextMode = activeMode === 'route' ? 'discover' : 'route'
      selectMode(nextMode)
    }

    if (event.key === 'Home') {
      event.preventDefault()
      selectMode('route')
    }

    if (event.key === 'End' && showDiscovery) {
      event.preventDefault()
      selectMode('discover')
    }
  }

  return (
    <div className="search-mode-tabs" role="tablist" aria-label={ro.searchModesLabel}>
      <button
        ref={routeTabRef}
        id="route-mode-tab"
        type="button"
        role="tab"
        aria-selected={activeMode === 'route'}
        aria-controls="route-search-panel"
        tabIndex={activeMode === 'route' ? 0 : -1}
        onClick={() => selectMode('route')}
        onKeyDown={handleKeyDown}
      >
        <Search size={17} aria-hidden="true" />
        {ro.routeMode}
      </button>
      {showDiscovery ? (
        <button
          ref={discoverTabRef}
          id="discover-mode-tab"
          type="button"
          role="tab"
          aria-selected={activeMode === 'discover'}
          aria-controls="discover-search-panel"
          tabIndex={activeMode === 'discover' ? 0 : -1}
          onClick={() => selectMode('discover')}
          onKeyDown={handleKeyDown}
        >
          <MapPinned size={17} aria-hidden="true" />
          {ro.discoverMode}
        </button>
      ) : null}
    </div>
  )
}
