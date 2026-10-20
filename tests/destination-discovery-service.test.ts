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

function directDestination(): DirectDestinationOption {
  return {
    destinationStationId: 'codlea',
    departures: [train()],
    returns: [train({
      id: 'return',
      departureStationId: 'codlea',
      arrivalStationId: 'brasov',
      departureAt: '2026-09-03T18:00:00+03:00',
      arrivalAt: '2026-09-03T18:30:00+03:00',
    })],
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

  it.each([
    {
      label: 'a different Romanian service date',
      departure: train({
        departureAt: '2026-09-04T10:00:00+03:00',
        arrivalAt: '2026-09-04T10:30:00+03:00',
      }),
    },
    {
      label: 'a destination different from the result label',
      departure: train({ arrivalStationId: 'brasov' }),
    },
    {
      label: 'an invalid arrival time before its departure',
      departure: train({
        departureAt: '2026-09-03T10:30:00+03:00',
        arrivalAt: '2026-09-03T10:00:00+03:00',
      }),
    },
  ])('rejects a positive-bike departure with $label as invalid payload', async ({ departure }) => {
    const option: DirectDestinationOption = {
      ...directDestination(),
      departures: [departure],
    }
    const provider: TrainDataProvider = {
      id: 'wrong-date-discovery',
      async search() { throw new Error('not used') },
      async discoverDirectDestinations() {
        return {
          options: [option],
          providerId: 'wrong-date-discovery',
          fetchedAt: '2026-09-03T08:00:00+03:00',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.options).toEqual([])
    expect(result.meta).toMatchObject({
      coverage: 'invalid_payload',
      asOf: null,
      reliability: null,
      sources: [{ outcome: 'invalid_payload' }],
    })
    expect(result.meta.warning).toBe(
      'Nu am putut valida ruta și data returnate de sursă. Nu afișăm orare neverificate.',
    )
  })

  it('allows the return leg on the next Romanian calendar day', async () => {
    const option: DirectDestinationOption = {
      destinationStationId: 'codlea',
      departures: [train({
        departureAt: '2026-09-03T23:30:00+03:00',
        arrivalAt: '2026-09-04T00:30:00+03:00',
      })],
      returns: [train({
        id: 'next-day-return',
        departureStationId: 'codlea',
        arrivalStationId: 'brasov',
        departureAt: '2026-09-04T06:00:00+03:00',
        arrivalAt: '2026-09-04T07:00:00+03:00',
      })],
    }
    const provider: TrainDataProvider = {
      id: 'overnight-discovery',
      async search() { throw new Error('not used') },
      async discoverDirectDestinations() {
        return {
          options: [option],
          providerId: 'overnight-discovery',
          fetchedAt: '2026-09-03T08:00:00+03:00',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.options).toHaveLength(1)
    expect(result.options[0].returns[0].id).toBe('next-day-return')
  })

  it('drops destinations without an exact non-foldable bike-compatible departure', async () => {
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
              train({ id: 'foldable-bike', bikeType: 'foldable' as unknown as 'non_foldable' }),
              train({ id: 'truthy-string-bike', bikeAllowed: 'true' as unknown as boolean }),
              train({ id: 'directness-unknown', changes: undefined }),
            ],
            returns: [train({
              id: 'valid-return',
              departureStationId: 'codlea',
              arrivalStationId: 'brasov',
              departureAt: '2026-09-03T18:00:00+03:00',
              arrivalAt: '2026-09-03T18:30:00+03:00',
            })],
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

  it('uses chronological instants when discovery timestamps have different offsets', async () => {
    const providers: TrainDataProvider[] = [
      {
        id: 'later-instant',
        async search() { throw new Error('not used') },
        async discoverDirectDestinations() {
          return {
            options: [],
            providerId: 'later-instant',
            fetchedAt: '2026-09-03T10:30:00-05:00',
            outcome: 'success',
          }
        },
      },
      {
        id: 'lexically-later',
        async search() { throw new Error('not used') },
        async discoverDirectDestinations() {
          return {
            options: [],
            providerId: 'lexically-later',
            fetchedAt: '2026-09-03T11:00:00-04:00',
            outcome: 'success',
          }
        },
      },
    ]
    const aggregator = new DestinationDiscoveryService(
      providers,
      () => Date.parse('2026-09-03T15:45:00Z'),
    )

    const result = await aggregator.search(criteria)

    expect(result.meta.asOf).toBe('2026-09-03T10:30:00-05:00')
  })

  it('does not infer reliability for an empty discovery success from an unknown provider', async () => {
    const provider: TrainDataProvider = {
      id: 'new-provider',
      async search() { throw new Error('not used') },
      async discoverDirectDestinations() {
        return {
          options: [],
          providerId: 'new-provider',
          fetchedAt: '2026-09-03T08:00:00+03:00',
          outcome: 'success',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.meta.coverage).toBe('covered')
    expect(result.meta.reliability).toBeNull()
  })

  it('preserves cache provenance for successful destination responses', async () => {
    const provider: TrainDataProvider = {
      id: 'cached-discovery',
      async search() { throw new Error('not used') },
      async discoverDirectDestinations() {
        return {
          options: [],
          providerId: 'cached-discovery',
          fetchedAt: '2026-09-03T08:00:00+03:00',
          cached: true,
          outcome: 'success',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.meta).toMatchObject({ cacheStatus: 'cached', degraded: false })
    expect(result.meta.sources).toEqual([expect.objectContaining({ cached: true })])
  })

  it('does not describe unsupported discovery as a provider outage', async () => {
    const provider: TrainDataProvider = {
      id: 'cfr',
      async search() { throw new Error('not used') },
      async discoverDirectDestinations() {
        return {
          options: [],
          providerId: 'cfr',
          fetchedAt: '2026-09-03T08:00:00+03:00',
          outcome: 'unsupported',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.meta.coverage).toBe('unsupported')
    expect(result.meta.warning).toBeNull()
  })

  it('does not expose discovery provider exception details in the response warning', async () => {
    const privateDiagnostic = 'Authorization: Bearer private-session-token'
    const provider: TrainDataProvider = {
      id: 'private-discovery-provider',
      async search() { throw new Error('not used') },
      async discoverDirectDestinations() { throw new Error(privateDiagnostic) },
    }

    const result = await service([provider]).search(criteria)

    expect(result.meta.warning).toContain('Nu afișăm orare neverificate')
    expect(result.meta.sources?.[0]?.warning).toBe(result.meta.warning)
    expect(JSON.stringify(result)).not.toContain(privateDiagnostic)
  })

  it('drops unreviewed discovery warnings before returning public metadata', async () => {
    const privateDiagnostic = 'Authorization: Bearer private-session-token'
    const provider: TrainDataProvider = {
      id: 'private-discovery-provider',
      async search() { throw new Error('not used') },
      async discoverDirectDestinations() {
        return {
          options: [],
          providerId: 'private-discovery-provider',
          fetchedAt: '2026-09-03T08:00:00+03:00',
          outcome: 'unavailable',
          warning: privateDiagnostic,
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.meta.sources?.[0]?.warning).toBeNull()
    expect(result.meta.warning).toContain('Nu afișăm orare neverificate')
    expect(JSON.stringify(result)).not.toContain(privateDiagnostic)
  })

  it('does not expose discovery data observed more than one hour ago', async () => {
    const provider: TrainDataProvider = {
      id: 'stale-discovery',
      async search() { throw new Error('not used') },
      async discoverDirectDestinations() {
        return {
          options: [directDestination()], providerId: 'stale-discovery', outcome: 'success',
          fetchedAt: '2026-09-03T06:29:59+03:00',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.options).toEqual([])
    expect(result.meta).toMatchObject({ coverage: 'unavailable', asOf: null, reliability: null })
  })

  it('does not expose destination options explicitly marked stale', async () => {
    const provider: TrainDataProvider = {
      id: 'provider-stale-discovery',
      async search() { throw new Error('not used') },
      async discoverDirectDestinations() {
        return {
          options: [directDestination()],
          providerId: 'provider-stale-discovery',
          outcome: 'success',
          stale: true,
          fetchedAt: '2026-09-03T08:20:00+03:00',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.options).toEqual([])
    expect(result.meta).toMatchObject({ coverage: 'unavailable', asOf: null, reliability: null })
  })
})
