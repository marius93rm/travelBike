import { describe, expect, it, vi } from 'vitest'
import { ControlledTrainProvider } from '../server/providers/controlled-train-provider.js'
import type { TrainDataProvider } from '../server/providers/train-data-provider.js'

const criteria = {
  from: 'brasov',
  to: 'codlea',
  date: '2026-09-05',
  bike: true as const,
}

function success(providerId = 'cfr') {
  return {
    options: [],
    providerId,
    fetchedAt: '2026-09-04T10:00:00.000Z',
    outcome: 'success' as const,
  }
}

describe('ControlledTrainProvider', () => {
  it('limits concurrent upstream searches across different requests', async () => {
    let active = 0
    let highest = 0
    const releases: Array<() => void> = []
    const provider: TrainDataProvider = {
      id: 'cfr',
      async search() {
        active += 1
        highest = Math.max(highest, active)
        await new Promise<void>((resolve) => releases.push(resolve))
        active -= 1
        return success()
      },
    }
    const controlled = new ControlledTrainProvider(provider, { maxConcurrent: 2 })

    const searches = [0, 1, 2].map((index) => controlled.search({
      ...criteria,
      to: `${criteria.to}-${index}`,
    }))
    await vi.waitFor(() => expect(releases).toHaveLength(2))
    releases.splice(0).forEach((release) => release())
    await vi.waitFor(() => expect(releases).toHaveLength(1))
    releases.splice(0).forEach((release) => release())
    await Promise.all(searches)

    expect(highest).toBe(2)
  })

  it('fails closed when the outbound request budget is exhausted', async () => {
    let now = 0
    const search = vi.fn(async () => success())
    const provider: TrainDataProvider = { id: 'cfr', search }
    const controlled = new ControlledTrainProvider(provider, {
      maxRequests: 2,
      requestWindowMs: 60_000,
      clock: () => now,
    })

    await controlled.search(criteria)
    await controlled.search(criteria)
    const limited = await controlled.search(criteria)

    expect(search).toHaveBeenCalledTimes(2)
    expect(limited).toMatchObject({ outcome: 'rate_limited', retryAfterSeconds: 60 })
    now = 60_000
    await controlled.search(criteria)
    expect(search).toHaveBeenCalledTimes(3)
  })

  it('opens its circuit after repeated provider failures', async () => {
    let now = 0
    const search = vi.fn(async () => ({
      options: [],
      providerId: 'cfr',
      fetchedAt: '2026-09-04T10:00:00.000Z',
      outcome: 'invalid_payload' as const,
    }))
    const provider: TrainDataProvider = { id: 'cfr', search }
    const controlled = new ControlledTrainProvider(provider, {
      failureThreshold: 2,
      circuitOpenMs: 30_000,
      clock: () => now,
    })

    await controlled.search(criteria)
    await controlled.search(criteria)
    const open = await controlled.search(criteria)

    expect(search).toHaveBeenCalledTimes(2)
    expect(open).toMatchObject({ outcome: 'unavailable', retryAfterSeconds: 30 })
    expect(controlled.isReady()).toBe(false)
    now = 30_000
    expect(controlled.isReady()).toBe(true)
    await controlled.search(criteria)
    expect(search).toHaveBeenCalledTimes(3)
  })

  it('degrades readiness immediately after a provider failure and retries after cooldown', async () => {
    let now = 10_000
    const search = vi.fn(async () => ({
      options: [], providerId: 'cfr', fetchedAt: '2026-09-04T10:00:00.000Z',
      outcome: 'unavailable' as const,
    }))
    const controlled = new ControlledTrainProvider(
      { id: 'cfr', search },
      { clock: () => now, circuitOpenMs: 30_000 },
    )

    expect(controlled.isReady()).toBe(true)
    await controlled.search(criteria)
    expect(controlled.isReady()).toBe(false)
    now += 5_000
    expect(controlled.isReady()).toBe(true)
  })

  it('honors Retry-After immediately after the first rate-limited response', async () => {
    let now = 0
    const search = vi.fn(async () => ({
      options: [], providerId: 'cfr', fetchedAt: '2026-09-04T10:00:00.000Z',
      outcome: 'rate_limited' as const, retryAfterSeconds: 120,
    }))
    const controlled = new ControlledTrainProvider(
      { id: 'cfr', search },
      { clock: () => now, failureThreshold: 3 },
    )

    await controlled.search(criteria)
    const blocked = await controlled.search(criteria)

    expect(search).toHaveBeenCalledTimes(1)
    expect(blocked).toMatchObject({ outcome: 'rate_limited', retryAfterSeconds: 120 })
    now = 120_000
    await controlled.search(criteria)
    expect(search).toHaveBeenCalledTimes(2)
  })

  it('rejects excess queued requests instead of growing the queue without bounds', async () => {
    const releases: Array<() => void> = []
    const provider: TrainDataProvider = {
      id: 'cfr',
      async search() {
        await new Promise<void>((resolve) => releases.push(resolve))
        return success()
      },
    }
    const controlled = new ControlledTrainProvider(provider, {
      maxConcurrent: 1, maxQueue: 1,
    })

    const first = controlled.search(criteria)
    await vi.waitFor(() => expect(releases).toHaveLength(1))
    const second = controlled.search({ ...criteria, to: 'sibiu' })
    const rejected = await controlled.search({ ...criteria, to: 'sighisoara' })

    expect(rejected).toMatchObject({ outcome: 'unavailable', options: [] })
    releases.shift()?.()
    await vi.waitFor(() => expect(releases).toHaveLength(1))
    releases.shift()?.()
    await Promise.all([first, second])
  })
})
