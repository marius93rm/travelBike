import { stationsById } from '../../domain/stations.js'
import type { StationId } from '../../domain/train.js'
import { ro } from '../../i18n/ro.js'

interface RouteLineProps {
  stationIds: StationId[]
}

export function RouteLine({ stationIds }: RouteLineProps) {
  return (
    <section className="route-shell" aria-label={ro.routeSelected}>
      <div className="route-line" aria-hidden="true">
        {stationIds.map((stationId, index) => (
          <div className="route-stop" key={stationId}>
            <span className="route-dot" />
            {index < stationIds.length - 1 ? <span className="route-track" /> : null}
          </div>
        ))}
      </div>
      <div className="route-labels">
        {stationIds.map((stationId) => (
          <span key={stationId}>{stationsById.get(stationId)?.name ?? stationId}</span>
        ))}
      </div>
    </section>
  )
}
