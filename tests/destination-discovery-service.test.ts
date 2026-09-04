import { describe, expect, it } from 'vitest'
import type {
  DirectDestinationOption,
  DestinationSearchCriteria,
  TrainOption,
} from '../src/domain/train.js'
import type { TrainDataProvider } from '../server/providers/train-data-provider.js'
import { DestinationDiscoveryService } from '../server/services/destination-discovery-service.js'

const criteria: DestinationSearchCriteria = {
  from: 'brasov',
  date: '2026-09-03',
  bike: true,
  direct: true,
}

function train(overrides: Partial<TrainOption> = {}): TrainOption {
  return {
    id: 'outbound',
    trainNumber: '100',
    trainCategory: 'R',
    operator: 'Test Rail',
    departureStationId: 'brasov',
    arrivalStationId: 'codlea',
    departureAt: '2026-09-03T10:00:00+03:00',
    arrivalAt: '2026-09-03T10:30:00+03:00',
    durationMinutes: 30,
    changes: 0,
    bikeAllowed: true,
    bikeType: 'non_foldable',
    bikeReservation: 'unknown',
    bikeCapacity: null,
    bikeFeeLei: null,
    source: 'Test',
    sourceUrl: 'https://example.com',
    lastVerifiedAt: '2026-09-03T08:00:00+03:00',
    reliability: 'official',
    ...overrides,
  }
}

describe('DestinationDiscoveryService', () => {
  const service = (providers: TrainDataProvider[]) => new DestinationDiscoveryService(
    providers,
    () => Date.parse('2026-09-03T08:30:00+03:00'),
  )

  it('keeps only bike-compatible direct departures and returns after arrival', async () => {
    const option: DirectDestinationOption = {
      destinationStationId: 'codlea',
      departures: [train()],
      returns: [
        train({
          id: 'return-valid',
          departureStationId: 'codlea',
          arrivalStationId: 'brasov',
          departureAt: '2026-09-03T18:00:00+03:00',
          arrivalAt: '2026-09-03T18:30:00+03:00',
        }),
        train({
          id: 'return-with-change',
          departureStationId: 'codlea',
          arrivalStationId: 'brasov',
          departureAt: '2026-09-03T19:00:00+03:00',
          arrivalAt: '2026-09-03T20:00:00+03:00',
          changes: 1,
        }),
        train({
          id: 'return-too-early',
          departureStationId: 'codlea',
          arrivalStationId: 'brasov',
          departureAt: '2026-09-03T09:00:00+03:00',
          arrivalAt: '2026-09-03T09:30:00+03:00',
        }),
      ],
    }
    const provider: TrainDataProvider = {
      id: 'discovery-test',
      async search() {
        throw new Error('not used')
      },
      async discoverDirectDestinations() {
        return {
          options: [option],
          providerId: 'discovery-test',
          fetchedAt: '2026-09-03T08:00:00+03:00',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.options).toHaveLength(1)
    expect(result.options[0].departures.map((item) => item.id)).toEqual(['outbound'])
    expect(result.options[0].returns.map((item) => item.id)).toEqual(['return-valid'])
  })

  it('drops destinations without a confirmed direct bike departure', async () => {
    const provider: TrainDataProvider = {
      id: 'unsafe-discovery',
      async search() {
        throw new Error('not used')
      },
      async discoverDirectDestinations() {
        return {
          options: [{
            destinationStationId: 'codlea',
            departures: [
              train({ bikeAllowed: false }),
              train({ id: 'directness-unknown', changes: undefined }),
            ],
            returns: [],
          }],
          providerId: 'unsafe-discovery',
          fetchedAt: '2026-09-03T08:00:00+03:00',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.options).toEqual([])
  })

  it('drops destinations without a later direct bike-compatible return', async () => {
    const provider: TrainDataProvider = {
      id: 'one-way-only',
      async search() {
        throw new Error('not used')
      },
      async discoverDirectDestinations() {
        return {
          options: [{
            destinationStationId: 'codlea',
            departures: [train()],
            returns: [train({
              departureStationId: 'codlea',
              arrivalStationId: 'brasov',
              departureAt: '2026-09-03T09:00:00+03:00',
              arrivalAt: '2026-09-03T09:30:00+03:00',
            })],
          }],
          providerId: 'one-way-only',
          fetchedAt: '2026-09-03T08:00:00+03:00',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.options).toEqual([])
  })

  it('does not expose discovery data observed more than one hour ago', async () => {
    const provider: TrainDataProvider = {
      id: 'stale-discovery',
      async search() { throw new Error('not used') },
      async discoverDirectDestinations() {
        return {
          options: [], providerId: 'stale-discovery', outcome: 'success',
          fetchedAt: '2026-09-03T06:29:59+03:00',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.meta).toMatchObject({ coverage: 'unavailable', asOf: null })
  })
})
