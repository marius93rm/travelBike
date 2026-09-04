import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../server/app.js'
import { FallbackTrainProvider } from '../server/providers/fallback-train-provider.js'
import { TrainSearchService } from '../server/services/train-search-service.js'
import { DestinationDiscoveryService } from '../server/services/destination-discovery-service.js'
import type { TrainDataProvider } from '../server/providers/train-data-provider.js'
import { createPilotStationConfig } from '../server/config/pilot.js'
import { ControlledTrainProvider } from '../server/providers/controlled-train-provider.js'

const demoProvider = new FallbackTrainProvider({ demoEnabled: true })
const fallbackProvider: TrainDataProvider = {
  id: 'test-current',
  capabilities: { journeySearch: true, directDestinationDiscovery: true },
  async search(criteria) {
    const result = await demoProvider.search(criteria)
    return {
      ...result, providerId: 'test-current', stale: false, outcome: 'success',
      fetchedAt: '2026-09-03T06:00:00.000Z',
    }
  },
  async discoverDirectDestinations(criteria) {
    const result = await demoProvider.discoverDirectDestinations(criteria)
    return { ...result, providerId: 'test-current', stale: false, outcome: 'success' }
  },
}
const app = createApp(
  new TrainSearchService([fallbackProvider], () => Date.parse('2026-09-03T09:00:00+03:00')),
  new DestinationDiscoveryService([fallbackProvider]),
  () => new Date('2026-09-03T09:00:00+03:00'),
  {
    pilot: createPilotStationConfig('brasov,codlea'),
    journeySearchAvailable: true,
    discoveryAvailable: true,
    providerReady: true,
  },
)

describe('GET /api/trains', () => {
  it('returns the bike-only result for a valid journey', async () => {
    const response = await request(app).get('/api/trains').query({
      from: 'codlea',
      to: 'brasov',
      date: '2026-09-03',
      bike: 'true',
    })

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(response.body.options).toHaveLength(1)
    expect(response.body.options[0].trainNumber).toBe('1622')
  })

  it('rejects attempts to disable the bicycle requirement', async () => {
    const response = await request(app).get('/api/trains').query({
      from: 'codlea',
      to: 'brasov',
      date: '2026-09-03',
      bike: 'false',
    })

    expect(response.status).toBe(400)
  })

  it('does not search stations outside the pilot route', async () => {
    const response = await request(app).get('/api/trains').query({
      from: 'cfr-20658',
      to: 'brasov',
      date: '2026-09-03',
      bike: 'true',
    })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ options: [], meta: { coverage: 'unsupported' } })
  })

  it('rejects dates outside the bounded journey window', async () => {
    const response = await request(app).get('/api/trains').query({
      from: 'codlea',
      to: 'brasov',
      date: '9999-12-31',
      bike: 'true',
    })

    expect(response.status).toBe(400)
  })
})

describe('GET /api/destinations', () => {
  it('returns direct destinations with a later direct return', async () => {
    const response = await request(app).get('/api/destinations').query({
      from: 'brasov',
      date: '2026-09-03',
      bike: 'true',
      direct: 'true',
    })

    expect(response.status).toBe(200)
    expect(response.body.options).toHaveLength(1)
    expect(response.body.options[0].destinationStationId).toBe('codlea')
    expect(response.body.options[0].departures[0].trainNumber).toBe('1621')
    expect(response.body.options[0].returns[0].trainNumber).toBe('1622')
  })

  it('rejects discovery requests that allow changes', async () => {
    const response = await request(app).get('/api/destinations').query({
      from: 'brasov',
      date: '2026-09-03',
      bike: 'true',
      direct: 'false',
    })

    expect(response.status).toBe(400)
  })
})

describe('operational API endpoints', () => {
  it('exposes liveness, degraded readiness, request IDs and safe response headers', async () => {
    const response = await request(createApp(new TrainSearchService([])))
      .get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true })
    expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/)
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBe('DENY')
    expect(response.headers['referrer-policy']).toBe('no-referrer')
    expect(response.headers['content-security-policy']).toContain("default-src 'self'")

    const readiness = await request(createApp(new TrainSearchService([]))).get('/api/readiness')
    expect(readiness.status).toBe(503)
    expect(readiness.body).toMatchObject({ ok: false, status: 'degraded' })
  })

  it('returns a JSON API 404 rather than falling through to the SPA', async () => {
    const response = await request(createApp(new TrainSearchService([]))).get('/api/missing')
    expect(response.status).toBe(404)
    expect(response.type).toMatch(/json/)
    expect(response.body).toEqual({ error: 'not_found', message: 'Ruta API nu există.' })
  })

  it('returns pilot coverage without searching a route outside the allowlist', async () => {
    const search = vi.fn<TrainDataProvider['search']>().mockResolvedValue({
      options: [], providerId: 'cfr', fetchedAt: '2026-09-03T09:00:00.000Z', outcome: 'success',
    })
    const provider: TrainDataProvider = {
      id: 'cfr', capabilities: { journeySearch: true, directDestinationDiscovery: false }, search,
    }
    const app = createApp(
      new TrainSearchService([provider]),
      undefined,
      () => new Date('2026-09-03T09:00:00+03:00'),
      {
        pilot: createPilotStationConfig('brasov,codlea'),
        journeySearchAvailable: true,
        providerReady: true,
      },
    )

    const outside = await request(app).get('/api/coverage').query({
      from: 'cfr-11906', to: 'brasov', date: '2026-09-03',
    })
    expect(outside.status).toBe(200)
    expect(outside.body).toEqual(expect.objectContaining({
      route: expect.objectContaining({ coverage: 'unsupported', supported: false }),
      discovery: expect.objectContaining({ coverage: 'unsupported', supported: false }),
    }))
    expect(search).not.toHaveBeenCalled()

    const allowed = await request(app).get('/api/coverage').query({
      from: 'brasov', to: 'codlea', date: '2026-09-03',
    })
    expect(allowed.status).toBe(200)
    expect(allowed.body).toEqual(expect.objectContaining({
      route: expect.objectContaining({ supported: true, coverage: 'available' }),
      discovery: expect.objectContaining({ supported: false, coverage: 'unsupported' }),
      pilot: expect.objectContaining({ region: 'Brașov, Sibiu, Covasna și Mureș' }),
    }))
    expect(search).not.toHaveBeenCalled()
  })

  it('returns explicit unavailable and unsupported states without calling providers', async () => {
    const search = vi.fn<TrainDataProvider['search']>()
    const provider: TrainDataProvider = { id: 'cfr', search }
    const app = createApp(
      new TrainSearchService([provider]),
      new DestinationDiscoveryService([provider]),
      () => new Date('2026-09-03T09:00:00+03:00'),
      {
        pilot: createPilotStationConfig('brasov,codlea'),
        journeySearchAvailable: false,
        discoveryAvailable: false,
        providerReady: false,
      },
    )

    const route = await request(app).get('/api/trains').query({
      from: 'brasov', to: 'codlea', date: '2026-09-03', bike: 'true',
    })
    expect(route.status).toBe(200)
    expect(route.body).toMatchObject({ options: [], meta: { coverage: 'unavailable' } })

    const discovery = await request(app).get('/api/destinations').query({
      from: 'brasov', date: '2026-09-03', bike: 'true', direct: 'true',
    })
    expect(discovery.status).toBe(200)
    expect(discovery.body).toMatchObject({ options: [], meta: { coverage: 'unsupported' } })
    expect(search).not.toHaveBeenCalled()
  })

  it('rate limits incoming API requests and supplies Retry-After', async () => {
    const app = createApp(new TrainSearchService([]), undefined, undefined, {
      rateLimit: { windowMs: 60_000, maxRequests: 1 },
    })
    await request(app).get('/api/health').expect(200)
    await request(app).get('/api/health').expect(200)
    await request(app).get('/api/missing').expect(404)
    const response = await request(app).get('/api/missing')
    expect(response.status).toBe(429)
    expect(response.headers['retry-after']).toBe('60')
    expect(response.body).toEqual({
      error: 'rate_limited', message: 'Prea multe cereri. Încearcă din nou în curând.',
    })
  })

  it('never accepts a national station outside the versioned regional allowlist', async () => {
    const pilot = createPilotStationConfig('cfr-11906')
    expect(pilot.stationIds.has('cfr-11906')).toBe(false)
    expect(pilot.mappingComplete).toBe(false)
    expect(pilot.allowlistVersion).toBe('2026-09-04-hubs-v1')
    expect(pilot.verifiedAt).toBe('2026-09-04')
  })

  it('reflects runtime provider readiness without probing upstream', async () => {
    let providerReady = false
    const pilot = { ...createPilotStationConfig('brasov,codlea'), mappingComplete: true }
    const app = createApp(new TrainSearchService([]), undefined, undefined, {
      pilot,
      journeySearchAvailable: true,
      providerReady: () => providerReady,
    })

    await request(app).get('/api/readiness').expect(503)
    providerReady = true
    const response = await request(app).get('/api/readiness').expect(200)
    expect(response.body).toMatchObject({ ok: true, status: 'ready' })
  })

  it('changes readiness to degraded after an upstream provider failure', async () => {
    const provider: TrainDataProvider = {
      id: 'cfr',
      async search() {
        return {
          options: [], providerId: 'cfr', outcome: 'unavailable',
          fetchedAt: '2026-09-03T06:00:00.000Z',
        }
      },
    }
    const controlled = new ControlledTrainProvider(provider, { clock: () => 10_000 })
    const pilot = { ...createPilotStationConfig('brasov,codlea'), mappingComplete: true }
    const app = createApp(
      new TrainSearchService([controlled]),
      undefined,
      () => new Date('2026-09-03T09:00:00+03:00'),
      {
        pilot,
        journeySearchAvailable: true,
        providerReady: () => controlled.isReady(),
      },
    )

    await request(app).get('/api/readiness').expect(200)
    const search = await request(app).get('/api/trains').query({
      from: 'brasov', to: 'codlea', date: '2026-09-03', bike: 'true',
    })
    expect(search.body).toMatchObject({ meta: { coverage: 'unavailable' } })
    await request(app).get('/api/readiness').expect(503)
  })
})
