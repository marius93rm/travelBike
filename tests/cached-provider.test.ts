import { afterEach, describe, expect, it, vi } from 'vitest'
import { CachedTrainProvider } from '../server/providers/cached-train-provider.js'
import { MemoryCacheStore } from '../server/cache/cache-store.js'
import type { TrainDataProvider } from '../server/providers/train-data-provider.js'

const criteria = {
  from: 'codlea',
  to: 'brasov',
  date: '2026-09-03',
  bike: true as const,
}

describe('CachedTrainProvider', () => {
  afterEach(() => vi.restoreAllMocks())

  it('never serves cached data after the one-hour TTL expires', async () => {
    const observedAt = Date.parse('2026-09-03T10:00:00Z')
    let shouldFail = false
    const provider: TrainDataProvider = {
      id: 'official',
      async search() {
        if (shouldFail) throw new Error('offline')
        return {
          options: [],
          providerId: 'official',
          fetchedAt: '2026-09-03T10:00:00Z',
        }
      },
    }
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(observedAt)
    const cached = new CachedTrainProvider(provider, { ttlMs: 6_000 })
    await cached.search(criteria)
    shouldFail = true

    now.mockReturnValue(observedAt + 7_000)
    await expect(cached.search(criteria)).rejects.toThrow('offline')

    now.mockReturnValue(observedAt + 68_000)
    await expect(cached.search(criteria)).rejects.toThrow('offline')
  })

  it('coalesces concurrent misses for the same journey', async () => {
    let calls = 0
    const provider: TrainDataProvider = {
      id: 'official',
      async search() {
        calls += 1
        await Promise.resolve()
        return {
          options: [],
          providerId: 'official',
          fetchedAt: '2026-09-03T10:00:00Z',
        }
      },
    }
    const cached = new CachedTrainProvider(provider, {
      store: new MemoryCacheStore(),
      clock: () => Date.parse('2026-09-03T10:00:30Z'),
    })

    await Promise.all([
      cached.search(criteria),
      cached.search(criteria),
      cached.search(criteria),
    ])

    expect(calls).toBe(1)
  })

  it('caches authoritative empty answers but not upstream failures', async () => {
    let calls = 0
    const provider: TrainDataProvider = {
      id: 'official',
      async search() {
        calls += 1
        return {
          options: [],
          providerId: 'official',
          fetchedAt: '2026-09-03T10:00:00Z',
        }
      },
    }
    const cached = new CachedTrainProvider(provider, {
      store: new MemoryCacheStore(), ttlMs: 1_000,
      clock: () => Date.parse('2026-09-03T10:00:30Z'),
    })
    await cached.search(criteria)
    await cached.search(criteria)
    expect(calls).toBe(1)
  })

  it('rejects a successful response already observed more than one hour ago', async () => {
    const now = Date.parse('2026-09-04T12:00:00.000Z')
    const search = vi.fn(async () => ({
      options: [], providerId: 'official',
      fetchedAt: '2026-09-04T09:59:59.000Z', outcome: 'success' as const,
    }))
    const cached = new CachedTrainProvider(
      { id: 'official', search },
      { clock: () => now },
    )

    const first = await cached.search(criteria)
    const second = await cached.search(criteria)

    expect(first).toMatchObject({ outcome: 'unavailable', stale: true, options: [] })
    expect(second).toMatchObject({ outcome: 'unavailable', stale: true, options: [] })
    expect(search).toHaveBeenCalledTimes(2)
  })

  it('forwards provider capabilities and discovery support', () => {
    const provider: TrainDataProvider = {
      id: 'official',
      capabilities: { journeySearch: true, directDestinationDiscovery: false },
      async search() { return { options: [], providerId: 'official', fetchedAt: '2026-09-03T10:00:00Z' } },
    }
    const cached = new CachedTrainProvider(provider)
    expect(cached.capabilities).toEqual(provider.capabilities)
    expect(cached.discoverDirectDestinations).toBeUndefined()
  })
})
