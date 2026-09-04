import { describe, expect, it } from 'vitest'
import type { TrainDataProvider } from '../server/providers/train-data-provider.js'
import { TrainSearchService } from '../server/services/train-search-service.js'

const criteria = {
  from: 'codlea',
  to: 'brasov',
  date: '2026-09-03',
  bike: true as const,
}

describe('TrainSearchService', () => {
  const service = (providers: TrainDataProvider[]) => new TrainSearchService(
    providers,
    () => Date.parse('2026-09-03T10:30:00+03:00'),
  )

  it('never exposes a train where bikeAllowed is false', async () => {
    const provider: TrainDataProvider = {
      id: 'test-current',
      async search() {
        return {
          options: [
            {
              id: 'unsafe-result',
              trainNumber: '9999',
              trainCategory: 'R',
              operator: 'Test Rail',
              departureStationId: 'codlea',
              arrivalStationId: 'brasov',
              departureAt: '2026-09-03T18:00:00+03:00',
              arrivalAt: '2026-09-03T18:30:00+03:00',
              durationMinutes: 30,
              bikeAllowed: false,
              bikeType: 'non_foldable',
              bikeReservation: 'unknown',
              bikeCapacity: 12,
              bikeFeeLei: null,
              source: 'Test',
              sourceUrl: 'https://example.com',
              lastVerifiedAt: '2026-09-03T10:00:00+03:00',
              reliability: 'official',
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

  it('reports an unavailable source instead of presenting stale fallback data', async () => {
    const unavailableProvider: TrainDataProvider = {
      id: 'cfr',
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
    })
    expect(result.meta.sources).toEqual([
      expect.objectContaining({ providerId: 'cfr', outcome: 'unavailable' }),
    ])
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

  it('reports unsupported coverage without calling later demo providers', async () => {
    const unsupported: TrainDataProvider = {
      id: 'cfr',
      async search() { return { options: [], providerId: 'cfr', fetchedAt: '2026-09-03T10:00:00+03:00', outcome: 'unsupported' } },
    }
    const result = await service([unsupported]).search(criteria)
    expect(result.meta.coverage).toBe('unsupported')
    expect(result.meta.asOf).toBeNull()
  })

  it('does not present stale provider data as current coverage', async () => {
    const stale: TrainDataProvider = {
      id: 'cached-cfr',
      async search() {
        return {
          options: [], providerId: 'cached-cfr', fetchedAt: '2026-09-03T08:00:00+03:00',
          outcome: 'success', stale: true,
        }
      },
    }
    const result = await service([stale]).search(criteria)
    expect(result.meta).toMatchObject({ coverage: 'unavailable', asOf: null })
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
          options: [], providerId: 'cfr', outcome: 'success',
          fetchedAt: '2026-09-03T08:29:59+03:00',
        }
      },
    }

    const result = await service([staleByAge]).search(criteria)

    expect(result.meta).toMatchObject({ coverage: 'unavailable', asOf: null })
    expect(result.meta.sources).toEqual([
      expect.objectContaining({ providerId: 'cfr', outcome: 'unavailable' }),
    ])
  })
})
