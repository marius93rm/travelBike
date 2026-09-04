import type { TrainSearchCriteria } from '../../src/domain/train.js'
import { MemoryCacheStore, type CacheStore } from '../cache/cache-store.js'
import type { ProviderSearchResult, TrainDataProvider } from './train-data-provider.js'

const MAX_CURRENT_TTL_MS = 60 * 60 * 1000

export interface CachedTrainProviderOptions {
  store?: CacheStore
  /** Values above an hour are clamped so stale timetable data cannot be served. */
  ttlMs?: number
  maxEntries?: number
  clock?: () => number
}

export class CachedTrainProvider implements TrainDataProvider {
  readonly id: string
  readonly capabilities: TrainDataProvider['capabilities']
  readonly isReady?: TrainDataProvider['isReady']
  readonly discoverDirectDestinations?: TrainDataProvider['discoverDirectDestinations']
  private readonly store: CacheStore
  private readonly ttlMs: number
  private readonly clock: () => number
  private readonly inFlight = new Map<string, Promise<ProviderSearchResult>>()

  constructor(provider: TrainDataProvider, options?: CachedTrainProviderOptions)
  /** @deprecated Positional settings remain accepted while deployments migrate. */
  constructor(provider: TrainDataProvider, ttlMs?: number, _maxStaleMs?: number, maxEntries?: number)
  constructor(
    private readonly provider: TrainDataProvider,
    optionsOrTtl: CachedTrainProviderOptions | number = {},
    _maxStaleMs?: number,
    legacyMaxEntries?: number,
  ) {
    const options = typeof optionsOrTtl === 'number'
      ? { ttlMs: optionsOrTtl, maxEntries: legacyMaxEntries }
      : optionsOrTtl
    this.id = `cached:${provider.id}`
    this.capabilities = provider.capabilities
    if (provider.isReady) this.isReady = provider.isReady.bind(provider)
    this.store = options.store ?? new MemoryCacheStore()
    this.ttlMs = Math.min(Math.max(1, options.ttlMs ?? MAX_CURRENT_TTL_MS), MAX_CURRENT_TTL_MS)
    this.clock = options.clock ?? Date.now
    if (provider.discoverDirectDestinations) {
      this.discoverDirectDestinations = provider.discoverDirectDestinations.bind(provider)
    }
  }

  async search(criteria: TrainSearchCriteria): Promise<ProviderSearchResult> {
    const key = this.cacheKey(criteria)
    const cached = this.store.get<ProviderSearchResult>(key, this.clock())
    if (cached) return cached.value

    const existingRequest = this.inFlight.get(key)
    if (existingRequest) return existingRequest

    const request = this.refresh(criteria, key).finally(() => {
      this.inFlight.delete(key)
    })
    this.inFlight.set(key, request)
    return request
  }

  private async refresh(
    criteria: TrainSearchCriteria,
    key: string,
  ): Promise<ProviderSearchResult> {
    const result = await this.provider.search(criteria)
    const now = this.clock()
    const observedAt = Date.parse(result.fetchedAt)
    const ageMs = now - observedAt
    if (
      (result.outcome ?? 'success') === 'success'
      && (!Number.isFinite(observedAt) || ageMs > MAX_CURRENT_TTL_MS || ageMs < -5 * 60 * 1000)
    ) {
      return {
        ...result,
        options: [],
        outcome: 'unavailable',
        stale: true,
        warning: 'Datele providerului sunt mai vechi de o oră sau au un marcaj temporal invalid.',
      }
    }
    // Empty success is authoritative; failures must be retried rather than cached.
    if ((result.outcome ?? 'success') === 'success' && result.stale !== true) {
      const storedAt = now
      const expiresAt = Math.min(storedAt + this.ttlMs, observedAt + MAX_CURRENT_TTL_MS)
      if (expiresAt > storedAt) {
        this.store.set({ key, storedAt, expiresAt, value: result })
      }
    }
    return result
  }

  private cacheKey(criteria: TrainSearchCriteria) {
    return `${this.provider.id}:journey:${criteria.from}:${criteria.to}:${criteria.date}:${criteria.bike}`
  }
}
