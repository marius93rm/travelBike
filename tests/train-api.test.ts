import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchDestinations, fetchTrains } from '../src/data/train-api.js'
import type { DestinationSearchCriteria, TrainSearchCriteria } from '../src/domain/train.js'

const routeCriteria: TrainSearchCriteria = {
  from: 'codlea',
  to: 'brasov',
  date: '2026-10-20',
  bike: true,
}

const destinationCriteria: DestinationSearchCriteria = {
  from: 'brasov',
  date: '2026-10-20',
  bike: true,
  direct: true,
}

function mockJsonResponse(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  }))
}

describe('train API bicycle evidence boundary', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    { bikeAllowed: false, bikeType: 'non_foldable' },
    { bikeAllowed: true, bikeType: 'foldable' },
    { bikeAllowed: true, bikeType: undefined },
  ])('rejects route results without explicit non-foldable bicycle confirmation: $bikeAllowed/$bikeType', async (bike) => {
    mockJsonResponse({ options: [bike], meta: {} })

    await expect(fetchTrains(routeCriteria)).rejects.toThrow(/bicycle service/i)
  })

  it('keeps the fixed bicycle filter on route requests', async () => {
    mockJsonResponse({ options: [], meta: {} })

    await fetchTrains(routeCriteria)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('bike=true'),
      expect.objectContaining({ signal: undefined }),
    )
  })

  it('rejects a destination result when any nested journey lacks bicycle confirmation', async () => {
    mockJsonResponse({
      options: [{
        destinationStationId: 'codlea',
        departures: [{ bikeAllowed: true, bikeType: 'non_foldable', changes: 0 }],
        returns: [{ bikeAllowed: true, bikeType: 'foldable', changes: 0 }],
      }],
      meta: {},
    })

    await expect(fetchDestinations(destinationCriteria)).rejects.toThrow(/bicycle service/i)
  })

  it('rejects a destination journey if it is not confirmed direct', async () => {
    mockJsonResponse({
      options: [{
        destinationStationId: 'codlea',
        departures: [{ bikeAllowed: true, bikeType: 'non_foldable', changes: 1 }],
        returns: [],
      }],
      meta: {},
    })

    await expect(fetchDestinations(destinationCriteria)).rejects.toThrow(/direct journey/i)
  })
})
