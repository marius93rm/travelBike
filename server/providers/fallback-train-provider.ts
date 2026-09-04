import type {
  DestinationSearchCriteria,
  DirectDestinationOption,
  TrainOption,
  TrainSearchCriteria,
} from '../../src/domain/train.js'
import { scheduledAt } from '../lib/date-time.js'
import type {
  ProviderSearchResult,
  ProviderDestinationSearchResult,
  TrainDataProvider,
} from './train-data-provider.js'

const CFR_SOURCE_URL = 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries'
const FALLBACK_VERIFIED_ON = '2026-09-03'

export interface FallbackTrainProviderOptions {
  /** Enables static fixtures for demos only; it never claims live route coverage. */
  demoEnabled?: boolean
}

interface FallbackSchedule {
  id: string
  trainNumber: string
  trainCategory: string
  from: string
  to: string
  departureTime: string
  arrivalTime: string
}

const fallbackSchedule: FallbackSchedule[] = [
  {
    id: 'cfr-ir-1621-brasov-codlea',
    trainNumber: '1621',
    trainCategory: 'IR',
    from: 'brasov',
    to: 'codlea',
    departureTime: '12:32',
    arrivalTime: '12:55',
  },
  {
    id: 'cfr-ir-1622-codlea-brasov',
    trainNumber: '1622',
    trainCategory: 'IR',
    from: 'codlea',
    to: 'brasov',
    departureTime: '19:17',
    arrivalTime: '19:40',
  },
]

export class FallbackTrainProvider implements TrainDataProvider {
  readonly id = 'fallback'
  readonly capabilities = { journeySearch: true, directDestinationDiscovery: false }

  constructor(private readonly options: FallbackTrainProviderOptions = {}) {}

  async search(criteria: TrainSearchCriteria): Promise<ProviderSearchResult> {
    if (!this.options.demoEnabled) {
      return {
        options: [], providerId: this.id, fetchedAt: new Date().toISOString(),
        outcome: 'unsupported',
        warning: 'Datele demonstrative nu sunt disponibile în căutarea live.',
      }
    }
    const options = fallbackSchedule
      .filter(
        (train) =>
          criteria.date === FALLBACK_VERIFIED_ON &&
          train.from === criteria.from &&
          train.to === criteria.to,
      )
      .map((train) => this.toTrainOption(train, criteria.date))

    return {
      options,
      providerId: this.id,
      fetchedAt: new Date().toISOString(),
      outcome: 'success',
      stale: true,
      warning: 'Date demonstrative verificate la 3 septembrie 2026; nu reprezintă acoperire live.',
    }
  }

  async discoverDirectDestinations(
    criteria: DestinationSearchCriteria,
  ): Promise<ProviderDestinationSearchResult> {
    const departures = fallbackSchedule.filter(
      (train) =>
        criteria.date === FALLBACK_VERIFIED_ON && train.from === criteria.from,
    )
    const destinations = new Map<string, DirectDestinationOption>()

    for (const departure of departures) {
      const option = destinations.get(departure.to) ?? {
        destinationStationId: departure.to,
        departures: [],
        returns: fallbackSchedule
          .filter(
            (train) =>
              train.from === departure.to && train.to === criteria.from,
          )
          .map((train) => this.toTrainOption(train, criteria.date)),
      }
      option.departures.push(this.toTrainOption(departure, criteria.date))
      destinations.set(departure.to, option)
    }

    return {
      options: [...destinations.values()],
      providerId: this.id,
      fetchedAt: new Date().toISOString(),
      outcome: 'unsupported',
      warning: 'Explorarea destinațiilor nu este disponibilă pentru date demonstrative.',
    }
  }

  private toTrainOption(train: FallbackSchedule, date: string): TrainOption {
    return {
      id: train.id,
      trainNumber: train.trainNumber,
      trainCategory: train.trainCategory,
      operator: 'CFR Călători',
      departureStationId: train.from,
      arrivalStationId: train.to,
      departureAt: scheduledAt(date, train.departureTime),
      arrivalAt: scheduledAt(date, train.arrivalTime),
      durationMinutes: 23,
      changes: 0,
      bikeAllowed: true,
      bikeType: 'non_foldable',
      bikeReservation: 'unknown',
      bikeCapacity: null,
      bikeFeeLei: 8,
      source: 'CFR Călători',
      sourceUrl: CFR_SOURCE_URL,
      lastVerifiedAt: FALLBACK_VERIFIED_ON,
      reliability: 'fallback',
    }
  }
}
