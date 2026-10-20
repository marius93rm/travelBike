import { describe, expect, it } from 'vitest'
import type { TrainOption } from '../src/domain/train.js'
import type { TrainDataProvider } from '../server/providers/train-data-provider.js'
import { TrainSearchService } from '../server/services/train-search-service.js'

const criteria = {
  from: 'codlea',
  to: 'brasov',
  date: '2026-09-03',
  bike: true as const,
}

const staleBikeTrain: TrainOption = {
  id: 'stale-ir-1622',
  trainNumber: '1622',
  trainCategory: 'IR',
  operator: 'CFR Călători',
  departureStationId: 'codlea',
  arrivalStationId: 'brasov',
  departureAt: '2026-09-03T12:32:00+03:00',
  arrivalAt: '2026-09-03T12:55:00+03:00',
  durationMinutes: 23,
  bikeAllowed: true,
  bikeType: 'non_foldable',
  bikeReservation: 'unknown',
  bikeCapacity: null,
  bikeFeeLei: null,
  source: 'CFR Călători',
  sourceUrl: 'https://www.cfrcalatori.ro/',
  lastVerifiedAt: '2026-09-03T10:00:00+03:00',
  reliability: 'official',
}

describe('TrainSearchService', () => {
  const service = (providers: TrainDataProvider[]) => new TrainSearchService(
    providers,
    () => Date.parse('2026-09-03T10:30:00+03:00'),
  )

  it('requires exact positive bicycle evidence for the non-foldable type', async () => {
    const provider: TrainDataProvider = {
      id: 'test-current',
      async search() {
        const baseOption = {
          trainNumber: '9999',
          trainCategory: 'R',
          operator: 'Test Rail',
          departureStationId: 'codlea' as const,
          arrivalStationId: 'brasov' as const,
          departureAt: '2026-09-03T18:00:00+03:00',
          arrivalAt: '2026-09-03T18:30:00+03:00',
          durationMinutes: 30,
          bikeReservation: 'unknown' as const,
          bikeCapacity: 12,
          bikeFeeLei: null,
          source: 'Test',
          sourceUrl: 'https://example.com',
          lastVerifiedAt: '2026-09-03T10:00:00+03:00',
          reliability: 'official' as const,
        }
        return {
          options: [
            {
              id: 'unsafe-result',
              ...baseOption,
              bikeAllowed: false,
              bikeType: 'non_foldable',
            },
            {
              id: 'foldable-result',
              ...baseOption,
              bikeAllowed: true,
              bikeType: 'foldable' as unknown as 'non_foldable',
            },
            {
              id: 'truthy-string-result',
              ...baseOption,
              bikeAllowed: 'true' as unknown as boolean,
              bikeType: 'non_foldable',
            },
          ],
          providerId: 'test-current',
          fetchedAt: '2026-09-03T10:00:00+03:00',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.options).toEqual([])
  })

  it.each([
    {
      label: 'a different route',
      option: { ...staleBikeTrain, arrivalStationId: 'sibiu' as const },
    },
    {
      label: 'a different Romanian service date',
      option: {
        ...staleBikeTrain,
        departureAt: '2026-09-04T12:32:00+03:00',
        arrivalAt: '2026-09-04T12:55:00+03:00',
      },
    },
    {
      label: 'an arrival time before its departure',
      option: {
        ...staleBikeTrain,
        departureAt: '2026-09-03T12:55:00+03:00',
        arrivalAt: '2026-09-03T12:32:00+03:00',
      },
    },
  ])('rejects a positive-bike result with $label as invalid payload', async ({ option }) => {
    const provider: TrainDataProvider = {
      id: 'test-current',
      async search() {
        return {
          options: [option],
          providerId: 'test-current',
          fetchedAt: '2026-09-03T10:00:00+03:00',
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

  it('does not expose provider exception details in the response warning', async () => {
    const privateDiagnostic = 'Authorization: Bearer private-session-token'
    const provider: TrainDataProvider = {
      id: 'private-provider',
      async search() { throw new Error(privateDiagnostic) },
    }

    const result = await service([provider]).search(criteria)

    expect(result.meta.warning).toContain('Nu afișăm orare neverificate')
    expect(result.meta.sources?.[0]?.warning).toBe(result.meta.warning)
    expect(JSON.stringify(result)).not.toContain(privateDiagnostic)
  })

  it('drops unreviewed provider warnings before returning public metadata', async () => {
    const privateDiagnostic = 'Authorization: Bearer private-session-token'
    const provider: TrainDataProvider = {
      id: 'private-provider',
      async search() {
        return {
          options: [],
          providerId: 'private-provider',
          fetchedAt: '2026-09-03T10:00:00+03:00',
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

  it('preserves reviewed provider warning copy', async () => {
    const provider: TrainDataProvider = {
      id: 'cfr',
      async search() {
        return {
          options: [],
          providerId: 'cfr',
          fetchedAt: '2026-09-03T10:00:00+03:00',
          outcome: 'rate_limited',
          warning: 'Bugetul de cereri către CFR a fost epuizat temporar.',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.meta.warning).toBe('Bugetul de cereri către CFR a fost epuizat temporar.')
  })

  it('reports an unavailable source instead of presenting stale fallback data', async () => {
    const sourceInfo = {
      name: 'CFR Călători',
      url: 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries',
    }
    const unavailableProvider: TrainDataProvider = {
      id: 'cfr',
      sourceInfo,
      async search() {
        return {
          options: [],
          providerId: 'cfr',
          fetchedAt: '2026-09-03T10:00:00+03:00',
          outcome: 'unavailable',
        }
      },
    }

    const result = await service([unavailableProvider]).search(criteria)

    expect(result.options).toEqual([])
    expect(result.meta).toMatchObject({
      degraded: true,
      coverage: 'unavailable',
      partial: false,
      reliability: null,
    })
    expect(result.meta.sources).toEqual([
      expect.objectContaining({
        providerId: 'cfr', outcome: 'unavailable', sourceInfo,
      }),
    ])
  })

  it('reports cached, live and mixed freshness separately from degraded coverage', async () => {
    const provider = (id: string, cached = false): TrainDataProvider => ({
      id,
      async search() {
        return {
          options: [],
          providerId: id,
          fetchedAt: '2026-09-03T10:00:00+03:00',
          ...(cached ? { cached: true } : {}),
        }
      },
    })

    const live = await service([provider('cfr')]).search(criteria)
    const cached = await service([provider('cfr', true)]).search(criteria)
    const mixed = await service([provider('cfr'), provider('secondary', true)]).search(criteria)

    expect(live.meta).toMatchObject({ cacheStatus: 'live', degraded: false })
    expect(cached.meta).toMatchObject({ cacheStatus: 'cached', degraded: false })
    expect(cached.meta.sources).toEqual([expect.objectContaining({ cached: true })])
    expect(mixed.meta).toMatchObject({ cacheStatus: 'mixed', degraded: false })
    expect(mixed.meta.sources?.map((source) => source.cached)).toEqual([undefined, true])
  })

  it('does not fill an authoritative empty response with fallback trains', async () => {
    const officialProvider: TrainDataProvider = {
      id: 'cfr',
      async search() {
        return {
          options: [],
          providerId: 'cfr',
          fetchedAt: '2026-09-03T10:00:00+03:00',
        }
      },
    }

    const result = await service([
      officialProvider,
    ]).search(criteria)

    expect(result.options).toEqual([])
    expect(result.meta.providerId).toBe('cfr')
    expect(result.meta.coverage).toBe('covered')
    expect(result.meta.reliability).toBe('official')
  })

  it('does not infer reliability for an empty success from an unknown provider', async () => {
    const provider: TrainDataProvider = {
      id: 'new-provider',
      async search() {
        return {
          options: [],
          providerId: 'new-provider',
          fetchedAt: '2026-09-03T10:00:00+03:00',
          outcome: 'success',
        }
      },
    }

    const result = await service([provider]).search(criteria)

    expect(result.meta.coverage).toBe('covered')
    expect(result.meta.reliability).toBeNull()
  })

  it('aggregates applicable providers, safely deduplicates trains, and records provenance', async () => {
    const train = {
      id: 'same-train', trainNumber: '123', trainCategory: 'IR', operator: 'CFR',
      departureStationId: 'codlea', arrivalStationId: 'brasov',
      departureAt: '2026-09-03T10:00:00+03:00', arrivalAt: '2026-09-03T10:30:00+03:00',
      durationMinutes: 30, bikeAllowed: true, bikeType: 'non_foldable' as const,
      bikeReservation: 'unknown' as const, bikeCapacity: null, bikeFeeLei: null,
      source: 'CFR', sourceUrl: 'https://example.com', lastVerifiedAt: '2026-09-03T10:00:00+03:00',
      reliability: 'official' as const,
    }
    const providers: TrainDataProvider[] = ['cfr', 'other'].map((id) => ({
      id,
      async search() {
        return { options: [train], providerId: id, fetchedAt: '2026-09-03T10:00:00+03:00', outcome: 'success' }
      },
    }))
    const result = await service(providers).search(criteria)
    expect(result.options).toHaveLength(1)
    expect(result.meta.partial).toBe(false)
    expect(result.meta.sources).toHaveLength(2)
  })

  it('uses chronological instants when provider timestamps have different offsets', async () => {
    const providers: TrainDataProvider[] = [
      {
        id: 'later-instant',
        async search() {
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
        async search() {
          return {
            options: [],
            providerId: 'lexically-later',
            fetchedAt: '2026-09-03T11:00:00-04:00',
            outcome: 'success',
          }
        },
      },
    ]
    const aggregator = new TrainSearchService(
      providers,
      () => Date.parse('2026-09-03T15:45:00Z'),
    )

    const result = await aggregator.search(criteria)

    expect(result.meta.asOf).toBe('2026-09-03T10:30:00-05:00')
  })

  it('reports unsupported coverage without calling later demo providers', async () => {
    const unsupported: TrainDataProvider = {
      id: 'cfr',
      async search() { return { options: [], providerId: 'cfr', fetchedAt: '2026-09-03T10:00:00+03:00', outcome: 'unsupported' } },
    }
    const result = await service([unsupported]).search(criteria)
    expect(result.meta.coverage).toBe('unsupported')
    expect(result.meta.asOf).toBeNull()
    expect(result.meta.reliability).toBeNull()
    expect(result.meta.warning).toBeNull()
  })

  it('does not present stale provider data as current coverage', async () => {
    const stale: TrainDataProvider = {
      id: 'cached-cfr',
      async search() {
        return {
          options: [staleBikeTrain], providerId: 'cached-cfr', fetchedAt: '2026-09-03T08:00:00+03:00',
          outcome: 'success', stale: true,
        }
      },
    }
    const result = await service([stale]).search(criteria)
    expect(result.options).toEqual([])
    expect(result.meta).toMatchObject({ coverage: 'unavailable', asOf: null, reliability: null })
  })

  it('does not let an unsupported provider hide an applicable provider failure', async () => {
    const providers: TrainDataProvider[] = [
      {
        id: 'outside-region',
        async search() {
          return { options: [], providerId: 'outside-region', fetchedAt: '', outcome: 'unsupported' }
        },
      },
      {
        id: 'cfr',
        async search() {
          return { options: [], providerId: 'cfr', fetchedAt: '', outcome: 'rate_limited' }
        },
      },
    ]

    const result = await service(providers).search(criteria)

    expect(result.meta.coverage).toBe('rate_limited')
    expect(result.meta.partial).toBe(false)
  })

  it('rejects success data whose observation is older than one hour', async () => {
    const staleByAge: TrainDataProvider = {
      id: 'cfr',
      async search() {
        return {
          options: [staleBikeTrain], providerId: 'cfr', outcome: 'success',
          fetchedAt: '2026-09-03T08:29:59+03:00',
        }
      },
    }

    const result = await service([staleByAge]).search(criteria)

    expect(result.options).toEqual([])
    expect(result.meta).toMatchObject({ coverage: 'unavailable', asOf: null })
    expect(result.meta.sources).toEqual([
      expect.objectContaining({ providerId: 'cfr', outcome: 'unavailable' }),
    ])
  })
})
