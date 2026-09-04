import { load } from 'cheerio'
import type { TrainOption, TrainSearchCriteria } from '../../src/domain/train.js'
import { scheduledAt } from '../lib/date-time.js'

const OPTION_SELECTOR =
  '[data-itinerary], .itinerary-result, .itineraryRow, .result-itinerary'
const EMPTY_SELECTOR = '[data-empty-results="true"], .no-results'
// Only positive machine-readable markers that have been explicitly normalized
// by this adapter may grant bike access. Human-facing title/alt text is too
// ambiguous (for example, it can describe a prohibition).
const BIKE_SELECTOR =
  '[data-bike-service="true"], [data-service-code="bike"]'
const TRAIN_PATTERN = /\b(IR|R-E|RE|R|IC)\s*([0-9]{2,5})\b/i
const TIME_PATTERN = /\b([01]\d|2[0-3]):[0-5]\d\b/g

function minutesBetween(departure: string, arrival: string): number {
  const [departureHours, departureMinutes] = departure.split(':').map(Number)
  const [arrivalHours, arrivalMinutes] = arrival.split(':').map(Number)
  const start = departureHours * 60 + departureMinutes
  const end = arrivalHours * 60 + arrivalMinutes
  return end >= start ? end - start : end + 24 * 60 - start
}

function crossesMidnight(departure: string, arrival: string) {
  return arrival.localeCompare(departure) < 0
}

/**
 * CFR HTML is an replaceable enrichment source, not a domain contract. Selectors
 * stay in this adapter so a markup change fails parser tests instead of leaking
 * into the search service or UI.
 */
export function parseCfrJourneyHtml(
  html: string,
  criteria: TrainSearchCriteria,
  sourceUrl: string,
  verifiedAt = new Date().toISOString(),
): TrainOption[] {
  const $ = load(html)
  const options: TrainOption[] = []
  const recognizedRows = $(OPTION_SELECTOR).length
  const recognizedEmptyState = $(EMPTY_SELECTOR).length > 0

  if (recognizedRows === 0 && !recognizedEmptyState) {
    throw new Error('CFR journey markup is not recognized')
  }

  $(OPTION_SELECTOR).each((index, element) => {
    const row = $(element)
    const text = row.text().replace(/\s+/g, ' ').trim()
    const bikeServiceIsExplicit =
      row.is(BIKE_SELECTOR) || row.find(BIKE_SELECTOR).length > 0

    if (!bikeServiceIsExplicit) return
    if (!row.is('[data-connection-count="0"]')) {
      return
    }

    const category = row.attr('data-train-category')
    const number = row.attr('data-train-number')
    const trainMatch = text.match(TRAIN_PATTERN)
    const trainCategory = category ?? trainMatch?.[1]?.toUpperCase()
    const trainNumber = number ?? trainMatch?.[2]
    const times = [...text.matchAll(TIME_PATTERN)].map((match) => match[0])
    const departureTime = row.attr('data-departure-time') ?? times[0]
    const arrivalTime = row.attr('data-arrival-time') ?? times.at(-1)

    if (!trainCategory || !trainNumber || !departureTime || !arrivalTime) {
      return
    }

    const reservation = row.attr('data-bike-reservation')
    const bikeReservation =
      reservation === 'required' || reservation === 'not_required'
        ? reservation
        : 'unknown'
    const operator = row.attr('data-operator') ?? 'CFR Călători'

    options.push({
      id: `cfr-${trainCategory.toLowerCase()}-${trainNumber}-${criteria.date}-${index}`,
      trainNumber,
      trainCategory,
      operator,
      departureStationId: criteria.from,
      arrivalStationId: criteria.to,
      departureAt: scheduledAt(criteria.date, departureTime),
      arrivalAt: scheduledAt(
        criteria.date,
        arrivalTime,
        crossesMidnight(departureTime, arrivalTime) ? 1 : 0,
      ),
      durationMinutes: minutesBetween(departureTime, arrivalTime),
      changes: 0,
      bikeAllowed: true,
      bikeType: 'non_foldable',
      bikeReservation,
      bikeCapacity: null,
      bikeFeeLei: null,
      source: 'CFR Călători',
      sourceUrl,
      lastVerifiedAt: verifiedAt,
      reliability: 'official',
    })
  })

  if (recognizedRows > 0 && options.length === 0) {
    throw new Error('CFR bicycle or direct-journey markers are not recognized')
  }

  return options
}
