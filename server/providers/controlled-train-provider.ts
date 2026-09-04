import type { TrainSearchCriteria } from '../../src/domain/train.js'
import type {
  ProviderSearchResult,
  TrainDataProvider,
} from './train-data-provider.js'

export interface ControlledTrainProviderOptions {
  maxConcurrent?: number
  maxQueue?: number
  maxRequests?: number
  requestWindowMs?: number
  failureThreshold?: number
  circuitOpenMs?: number
  clock?: () => number
  onEvent?: (event: Record<string, unknown>) => void
}

/**
 * Shared operational guard around an upstream adapter. It deliberately fails
 * closed instead of queueing without bounds or returning old journey data.
 */
export class ControlledTrainProvider implements TrainDataProvider {
  readonly id: string
  readonly capabilities: TrainDataProvider['capabilities']
  private readonly maxConcurrent: number
  private readonly maxQueue: number
  private readonly maxRequests: number
  private readonly requestWindowMs: number
  private readonly failureThreshold: number
  private readonly circuitOpenMs: number
  private readonly clock: () => number
  private active = 0
  private readonly waiters: Array<() => void> = []
  private requestTimes: number[] = []
  private consecutiveFailures = 0
  private circuitOpenUntil = 0
  private degradedUntil = 0
  private circuitOutcome: 'unavailable' | 'rate_limited' = 'unavailable'

  constructor(
    private readonly provider: TrainDataProvider,
    private readonly options: ControlledTrainProviderOptions = {},
  ) {
    this.id = `controlled:${provider.id}`
    this.capabilities = provider.capabilities
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 2)
    this.maxQueue = Math.max(0, options.maxQueue ?? 20)
    this.maxRequests = Math.max(1, options.maxRequests ?? 30)
    this.requestWindowMs = Math.max(1_000, options.requestWindowMs ?? 60_000)
    this.failureThreshold = Math.max(1, options.failureThreshold ?? 3)
    this.circuitOpenMs = Math.max(1_000, options.circuitOpenMs ?? 60_000)
    this.clock = options.clock ?? Date.now
  }

  async search(criteria: TrainSearchCriteria): Promise<ProviderSearchResult> {
    const now = this.clock()
    if (this.circuitOpenUntil > now) {
      return this.blocked(this.circuitOutcome, now, this.circuitOpenUntil - now)
    }

    this.requestTimes = this.requestTimes.filter(
      (timestamp) => timestamp > now - this.requestWindowMs,
    )
    if (this.requestTimes.length >= this.maxRequests) {
      const retryIn = this.requestTimes[0] + this.requestWindowMs - now
      return this.blocked('rate_limited', now, retryIn)
    }
    this.requestTimes.push(now)

    const release = await this.acquire()
    if (!release) return this.blocked('unavailable', this.clock(), 1_000)
    const startedAt = this.clock()
    try {
      const result = await this.provider.search(criteria)
      const outcome = result.outcome ?? 'success'
      if (outcome === 'success' || outcome === 'unsupported') {
        this.consecutiveFailures = 0
        this.circuitOutcome = 'unavailable'
        this.degradedUntil = 0
      } else {
        this.recordFailure(outcome, result.retryAfterSeconds)
      }
      this.options.onEvent?.({
        event: 'provider_request',
        providerId: this.provider.id,
        outcome,
        durationMs: this.clock() - startedAt,
      })
      return result
    } catch (error) {
      this.recordFailure('unavailable')
      this.options.onEvent?.({
        event: 'provider_request',
        providerId: this.provider.id,
        outcome: 'unavailable',
        durationMs: this.clock() - startedAt,
      })
      return {
        options: [],
        providerId: this.provider.id,
        fetchedAt: new Date(this.clock()).toISOString(),
        outcome: 'unavailable',
        warning: error instanceof Error ? error.message : 'provider failed',
      }
    } finally {
      release()
    }
  }

  isReady(): boolean {
    const now = this.clock()
    if (this.circuitOpenUntil > now || this.degradedUntil > now) return false
    this.requestTimes = this.requestTimes.filter(
      (timestamp) => timestamp > now - this.requestWindowMs,
    )
    return this.requestTimes.length < this.maxRequests
  }

  private recordFailure(
    outcome: Exclude<ProviderSearchResult['outcome'], 'success' | 'unsupported'>,
    retryAfterSeconds?: number,
  ) {
    this.consecutiveFailures += 1
    this.degradedUntil = Math.max(
      this.degradedUntil,
      this.clock() + Math.min(this.circuitOpenMs, 5_000),
    )
    if (outcome === 'rate_limited' && retryAfterSeconds && retryAfterSeconds > 0) {
      this.circuitOutcome = 'rate_limited'
      this.circuitOpenUntil = this.clock() + retryAfterSeconds * 1_000
      return
    }
    if (this.consecutiveFailures < this.failureThreshold) return
    const upstreamDelay = retryAfterSeconds ? retryAfterSeconds * 1_000 : 0
    this.circuitOutcome = 'unavailable'
    this.circuitOpenUntil = this.clock() + Math.max(this.circuitOpenMs, upstreamDelay)
  }

  private blocked(
    outcome: 'unavailable' | 'rate_limited',
    now: number,
    retryInMs: number,
  ): ProviderSearchResult {
    const retryAfterSeconds = Math.max(1, Math.ceil(retryInMs / 1_000))
    this.options.onEvent?.({
      event: 'provider_request',
      providerId: this.provider.id,
      outcome,
      blocked: true,
      retryAfterSeconds,
    })
    return {
      options: [],
      providerId: this.provider.id,
      fetchedAt: new Date(now).toISOString(),
      outcome,
      retryAfterSeconds,
      warning: outcome === 'rate_limited'
        ? 'Bugetul de cereri către CFR a fost epuizat temporar.'
        : 'Circuitul CFR este deschis după erori repetate.',
    }
  }

  private async acquire(): Promise<(() => void) | null> {
    if (this.active >= this.maxConcurrent) {
      if (this.waiters.length >= this.maxQueue) return null
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    }
    this.active += 1
    return () => {
      this.active -= 1
      this.waiters.shift()?.()
    }
  }
}
