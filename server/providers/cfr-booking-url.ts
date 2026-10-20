import type { TrainSearchCriteria } from '../../src/domain/train.js'
import { dateInRomania } from '../../src/domain/journey-date.js'

// CFR online planner Terms, section 1.2: a nominal 30-date window including today.
// Section 1.5 allows CFR to change it for all or individual trains; a prefilled
// planner URL is not evidence that ticket sales are open. Verified 2026-10-15.
// https://bilete.cfrcalatori.ro/ro-RO/Home/TermsConditions
const CFR_DOMESTIC_ADVANCE_SALE_WINDOW_DAYS = 30

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

/** Builds a public CFR planner link, separate from the acquisition and provenance URLs. */
export function buildCfrBookingUrl(
  criteria: TrainSearchCriteria,
  departureStationName: string,
  arrivalStationName: string,
  publicPlannerUrl: string,
  now = new Date(),
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(criteria.date)) return undefined
  const departureDate = new Date(`${criteria.date}T12:00:00Z`)
  if (!Number.isFinite(departureDate.getTime()) || departureDate.toISOString().slice(0, 10) !== criteria.date) {
    return undefined
  }

  const today = dateInRomania(now)
  const lastSaleDate = addDays(today, CFR_DOMESTIC_ADVANCE_SALE_WINDOW_DAYS - 1)
  if (criteria.date < today || criteria.date > lastSaleDate) {
    return undefined
  }

  const url = new URL(publicPlannerUrl)
  url.pathname = '/ro-RO/Itineraries'
  url.search = ''
  url.hash = ''

  const [year, month, day] = criteria.date.split('-')
  url.search = new URLSearchParams({
    ArrivalStationName: arrivalStationName,
    BetweenTrainsMinimumMinutes: '15',
    ChangeStationName: '',
    ConnectionsTypeId: '1',
    DepartureDate: `${day}.${month}.${year}`,
    DepartureStationName: departureStationName,
    IsBarRestaurantServiceRequired: 'False',
    IsBikesServiceRequired: 'True',
    IsOnlineBuyingRequired: 'False',
    IsSleeperCouchetteServiceRequired: 'False',
    MinutesInDay: '0',
    OrderingTypeId: '0',
    TimeSelectionId: '0',
  }).toString()

  return url.toString()
}
