import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../server/app.js'
import { CFR_PUBLIC_PROVIDER_LINK } from '../server/providers/cfr-train-provider.js'
import { FallbackTrainProvider } from '../server/providers/fallback-train-provider.js'
import { TrainSearchService } from '../server/services/train-search-service.js'
import { DestinationDiscoveryService } from '../server/services/destination-discovery-service.js'
import type { TrainDataProvider } from '../server/providers/train-data-provider.js'
import { createPilotStationConfig } from '../server/config/pilot.js'
import { ControlledTrainProvider } from '../server/providers/controlled-train-provider.js'
import type { DestinationSearchResponse } from '../src/domain/train.js'

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

  it('accepts the thirtieth calendar day and rejects the next day', async () => {
    const lastAllowedDay = await request(app).get('/api/trains').query({
      from: 'codlea', to: 'brasov', date: '2026-10-02', bike: 'true',
    })
    const firstOutsideDay = await request(app).get('/api/trains').query({
      from: 'codlea', to: 'brasov', date: '2026-10-03', bike: 'true',
    })

    expect(lastAllowedDay.status).toBe(200)
    expect(firstOutsideDay.status).toBe(400)
    expect(firstOutsideDay.body.issues[0].message).toContain('30')
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

  it('rejects dates after the published timetable validity', async () => {
    const response = await request(app).get('/api/trains').query({
      from: 'codlea',
      to: 'brasov',
      date: '2026-12-13',
      bike: 'true',
    })

    expect(response.status).toBe(400)
  })

  it('rejects every search after catalog expiry without consulting providers', async () => {
    const provider = new FallbackTrainProvider({ demoEnabled: true })
    const search = vi.spyOn(provider, 'search')
    const expiredApp = createApp(
      new TrainSearchService([provider]),
      undefined,
      () => new Date('2026-12-13T09:00:00+02:00'),
      {
        pilot: createPilotStationConfig('brasov,codlea'),
        journeySearchAvailable: true,
        providerReady: true,
      },
    )

    const response = await request(expiredApp).get('/api/trains').query({
      from: 'codlea',
      to: 'brasov',
      date: '2026-12-13',
      bike: 'true',
    })

    expect(response.status).toBe(400)
    expect(search).not.toHaveBeenCalled()
    search.mockRestore()
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

  it('does not expose discovered destinations outside the configured pilot', async () => {
    const discoveryResponse: DestinationSearchResponse = {
      options: [{ destinationStationId: 'cfr-20658', departures: [], returns: [] }],
      meta: {
        providerId: 'test-provider',
        reliability: 'official',
        fetchedAt: '2026-09-03T08:00:00+03:00',
        asOf: '2026-09-03T08:00:00+03:00',
        degraded: false,
        warning: null,
        coverage: 'covered',
        partial: false,
        sources: [],
      },
    }
    const discovery = { search: vi.fn().mockResolvedValue(discoveryResponse) }
    const scopedApp = createApp(
      new TrainSearchService([]),
      discovery as unknown as DestinationDiscoveryService,
      () => new Date('2026-09-03T09:00:00+03:00'),
      {
        pilot: createPilotStationConfig('brasov,codlea'),
        journeySearchAvailable: false,
        discoveryAvailable: true,
        providerReady: true,
      },
    )

    const response = await request(scopedApp).get('/api/destinations').query({
      from: 'brasov', date: '2026-09-03', bike: 'true', direct: 'true',
    })

    expect(response.status).toBe(200)
    expect(response.body.options).toEqual([])
    expect(discovery.search).toHaveBeenCalledOnce()
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
    expect(response.headers['content-security-policy']).toContain("form-action 'self'")
    expect(response.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=(), payment=()')

    const readiness = await request(createApp(new TrainSearchService([]))).get('/api/readiness')
    expect(readiness.status).toBe(503)
    expect(readiness.body).toMatchObject({ ok: false, status: 'degraded' })
  })

  it('adds HSTS only to the production server', async () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    try {
      const response = await request(createApp(new TrainSearchService([]))).get('/api/health')
      expect(response.headers['strict-transport-security']).toBe('max-age=31536000')
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = originalNodeEnv
    }
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
        providerLinks: [CFR_PUBLIC_PROVIDER_LINK],
      },
    )

    const route = await request(app).get('/api/trains').query({
      from: 'brasov', to: 'codlea', date: '2026-09-03', bike: 'true',
    })
    expect(route.status).toBe(200)
    expect(route.body).toMatchObject({
      options: [],
      meta: {
        coverage: 'unavailable', providerStatus: 'disabled', reliability: null,
        sources: [{
          providerId: 'cfr',
          sourceInfo: {
            name: 'CFR Călători',
            url: 'https://bilete.cfrcalatori.ro/ro-RO/Itineraries',
          },
          outcome: 'unavailable', fetchedAt: null, warning: null,
        }],
      },
    })
    expect(route.body.meta.sources[0].searchUrl).toBeDefined()
    const searchUrl = new URL(route.body.meta.sources[0].searchUrl)
    expect(searchUrl.searchParams.get('DepartureStationName')).toBe('Brașov')
    expect(searchUrl.searchParams.get('ArrivalStationName')).toBe('Codlea')
    expect(searchUrl.searchParams.get('DepartureDate')).toBe('03.09.2026')
    expect(searchUrl.searchParams.get('IsBikesServiceRequired')).toBe('True')

    const coverage = await request(app).get('/api/coverage').query({
      from: 'brasov', to: 'codlea', date: '2026-09-03',
    })
    expect(coverage.body.route).toMatchObject({
      coverage: 'unavailable', providerStatus: 'disabled',
    })

    const readiness = await request(app).get('/api/readiness')
    expect(readiness.body.providers.journeySearch).toBe('disabled')

    const discovery = await request(app).get('/api/destinations').query({
      from: 'brasov', date: '2026-09-03', bike: 'true', direct: 'true',
    })
    expect(discovery.status).toBe(200)
    expect(discovery.body).toMatchObject({
      options: [], meta: { coverage: 'unsupported', reliability: null },
    })
    expect(search).not.toHaveBeenCalled()
  })

  it('reports a configured but unready source as unavailable rather than disabled', async () => {
    const app = createApp(
      new TrainSearchService([]),
      undefined,
      () => new Date('2026-09-03T09:00:00+03:00'),
      {
        pilot: createPilotStationConfig('brasov,codlea'),
        journeySearchAvailable: true,
        providerReady: false,
      },
    )

    const route = await request(app).get('/api/trains').query({
      from: 'brasov', to: 'codlea', date: '2026-09-03', bike: 'true',
    })
    expect(route.body.meta).toMatchObject({
      coverage: 'unavailable', providerStatus: 'unavailable',
    })

    const coverage = await request(app).get('/api/coverage').query({
      from: 'brasov', to: 'codlea', date: '2026-09-03',
    })
    expect(coverage.body.route).toMatchObject({
      coverage: 'unavailable', providerStatus: 'unavailable',
    })

    const readiness = await request(app).get('/api/readiness')
    expect(readiness.status).toBe(503)
    expect(readiness.body.providers.journeySearch).toBe('unavailable')
  })

  it('prefills the operator search link when a live provider is temporarily unavailable', async () => {
    const provider: TrainDataProvider = {
      id: 'cfr',
      sourceInfo: CFR_PUBLIC_PROVIDER_LINK.sourceInfo,
      async search() {
        return {
          options: [],
          providerId: 'cfr',
          fetchedAt: '2026-09-03T09:00:00+03:00',
          outcome: 'unavailable',
        }
      },
    }
    const app = createApp(
      new TrainSearchService([provider], () => Date.parse('2026-09-03T09:00:00+03:00')),
      undefined,
      () => new Date('2026-09-03T09:00:00+03:00'),
      {
        pilot: createPilotStationConfig('brasov,codlea'),
        journeySearchAvailable: true,
        providerReady: true,
        providerLinks: [CFR_PUBLIC_PROVIDER_LINK],
      },
    )

    const route = await request(app).get('/api/trains').query({
      from: 'codlea', to: 'brasov', date: '2026-09-03', bike: 'true',
    })
    const source = route.body.meta.sources[0]
    const searchUrl = new URL(source.searchUrl)

    expect(source.outcome).toBe('unavailable')
    expect(searchUrl.searchParams.get('DepartureStationName')).toBe('Codlea')
    expect(searchUrl.searchParams.get('ArrivalStationName')).toBe('Brașov')
    expect(searchUrl.searchParams.get('DepartureDate')).toBe('03.09.2026')
    expect(searchUrl.searchParams.get('IsBikesServiceRequired')).toBe('True')
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

  it('uses only valid addresses from a configured Cloudflare client-IP header', async () => {
    const app = createApp(new TrainSearchService([]), undefined, undefined, {
      rateLimit: {
        windowMs: 60_000,
        maxRequests: 1,
        clientIpHeader: 'cf-connecting-ip',
      },
    })
    const send = (clientIp: string, forwardedFor: string) =>
      request(app).get('/api/missing')
        .set('cf-connecting-ip', clientIp)
        .set('x-forwarded-for', forwardedFor)

    await send('203.0.113.10', '198.51.100.99').expect(404)
    await send('203.0.113.11', '198.51.100.99').expect(404)
    await send('203.0.113.10', '198.51.100.100').expect(429)
    await send('not-an-ip', '198.51.100.99').expect(404)
    await send('203.0.113.12, 203.0.113.13', '198.51.100.100').expect(429)
  })

  it('never accepts a national station outside the versioned regional allowlist', async () => {
    const pilot = createPilotStationConfig('cfr-11906')
    expect(pilot.stationIds.has('cfr-11906')).toBe(false)
    expect(pilot.mappingComplete).toBe(false)
    expect(pilot.allowlistVersion).toBe('2026-09-16-counties-v1')
    expect(pilot.verifiedAt).toBe('2026-09-16')
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
