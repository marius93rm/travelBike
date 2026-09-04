import express from 'express'
import { z } from 'zod'
import { stations } from '../src/domain/stations.js'
import type {
  DestinationSearchCriteria,
  TrainSearchCriteria,
} from '../src/domain/train.js'
import { DestinationDiscoveryService } from './services/destination-discovery-service.js'
import { TrainSearchService } from './services/train-search-service.js'
import {
  createPilotStationConfig,
  routeIsInPilot,
  type PilotStationConfig,
} from './config/pilot.js'
import {
  apiOperations,
  apiRateLimit,
  type ApiLogger,
  type RateLimitOptions,
} from './http/operations.js'

const stationIds = new Set(stations.map((station) => station.id))
type Clock = () => Date

function queryFields(clock: Clock) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
  }).format(clock())
  const latestJourneyDate = new Date(`${today}T12:00:00Z`)
  latestJourneyDate.setUTCDate(latestJourneyDate.getUTCDate() + 120)
  const latestJourneyDateIso = latestJourneyDate.toISOString().slice(0, 10)

  return {
    from: z.string().refine((id) => stationIds.has(id), 'Stație necunoscută'),
    date: z.iso.date().refine(
      (date) => date >= today && date <= latestJourneyDateIso,
      'Data trebuie să fie în următoarele 120 de zile',
    ),
    bike: z.literal('true'),
  }
}

function createQuerySchema(clock: Clock) {
  return z
    .object({
      ...queryFields(clock),
      to: z.string().refine((id) => stationIds.has(id), 'Stație necunoscută'),
    })
    .refine((query) => query.from !== query.to, {
      message: 'Stațiile trebuie să fie diferite',
      path: ['to'],
    })
}

function createDestinationQuerySchema(clock: Clock) {
  return z.object({
    ...queryFields(clock),
    direct: z.literal('true'),
  })
}

function createCoverageQuerySchema(clock: Clock) {
  return z.object({
    from: queryFields(clock).from,
    to: z.string().refine((id) => stationIds.has(id), 'Stație necunoscută').optional(),
    date: queryFields(clock).date,
  }).refine((query) => !query.to || query.from !== query.to, {
    message: 'Stațiile trebuie să fie diferite', path: ['to'],
  })
}

export interface CreateAppOptions {
  pilot?: PilotStationConfig
  /** Whether a configured provider can perform a live point-to-point lookup. */
  journeySearchAvailable?: boolean
  /** Discovery needs an indexed, bike-safe timetable and is false until available. */
  discoveryAvailable?: boolean
  /** Readiness additionally requires an approved, enabled provider. */
  providerReady?: boolean | (() => boolean)
  rateLimit?: RateLimitOptions
  logger?: ApiLogger
  /** Number of trusted reverse-proxy hops; disabled unless explicitly configured. */
  trustProxy?: number
}

function availabilityResponse(
  coverage: 'unsupported' | 'unavailable',
  warning: string,
) {
  return {
    options: [],
    meta: {
      providerId: 'pilot', reliability: 'official' as const,
      fetchedAt: new Date().toISOString(), degraded: true,
      warning,
      coverage, asOf: null, partial: false, sources: [],
    },
  }
}

export function createApp(
  service: TrainSearchService,
  destinationService?: DestinationDiscoveryService,
  clock: Clock = () => new Date(),
  options: CreateAppOptions = {},
) {
  const app = express()
  const pilot = options.pilot ?? createPilotStationConfig()
  const journeySearchAvailable = options.journeySearchAvailable ?? true
  const discoveryAvailable = options.discoveryAvailable ?? false
  const providerIsReady = () => {
    try {
      return typeof options.providerReady === 'function'
        ? options.providerReady()
        : options.providerReady ?? false
    } catch {
      return false
    }
  }

  app.disable('x-powered-by')
  if (options.trustProxy !== undefined) app.set('trust proxy', options.trustProxy)
  app.use(apiOperations(options.logger))
  if (options.rateLimit) app.use(apiRateLimit(options.rateLimit))

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true })
  })

  app.get('/api/readiness', (_request, response) => {
    const providerReady = providerIsReady()
    const ready = providerReady && journeySearchAvailable && pilot.mappingComplete
    response.status(ready ? 200 : 503).json({
      ok: ready,
      status: ready ? 'ready' : 'degraded',
      pilot: {
        region: pilot.region, mappingComplete: pilot.mappingComplete, source: pilot.source,
        allowlistVersion: pilot.allowlistVersion, verifiedAt: pilot.verifiedAt,
      },
      providers: {
        journeySearch: journeySearchAvailable ? (providerReady ? 'ready' : 'disabled') : 'unavailable',
        discovery: discoveryAvailable ? 'ready' : 'unsupported',
      },
    })
  })

  app.get('/api/coverage', (request, response) => {
    const parsed = createCoverageQuerySchema(clock).safeParse(request.query)
    if (!parsed.success) {
      response.status(400).json({
        error: 'invalid_query',
        message: 'Verifică stațiile și data pentru acoperire.',
        issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      })
      return
    }
    const providerReady = providerIsReady()
    const routeSupported = routeIsInPilot(pilot, parsed.data.from, parsed.data.to)
    const discoverySupported = discoveryAvailable && routeIsInPilot(pilot, parsed.data.from)
    response.json({
      pilot: {
        region: pilot.region, mappingComplete: pilot.mappingComplete, source: pilot.source,
        allowlistVersion: pilot.allowlistVersion, verifiedAt: pilot.verifiedAt,
      },
      route: {
        supported: routeSupported,
        coverage: routeSupported
          ? journeySearchAvailable && providerReady ? 'available' : 'unavailable'
          : 'unsupported',
        providerStatus: routeSupported && journeySearchAvailable && providerReady
          ? 'ready'
          : routeSupported ? 'disabled' : 'unsupported',
      },
      discovery: {
        supported: discoverySupported,
        coverage: discoverySupported ? 'available' : 'unsupported',
        providerStatus: discoverySupported ? 'ready' : 'unsupported',
      },
    })
  })

  app.get('/api/trains', async (request, response) => {
    response.setHeader('Cache-Control', 'private, no-store')
    const parsed = createQuerySchema(clock).safeParse(request.query)

    if (!parsed.success) {
      response.status(400).json({
        error: 'invalid_query',
        message: 'Verifică stațiile, data și filtrul pentru bicicletă.',
        issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      })
      return
    }

    if (!routeIsInPilot(pilot, parsed.data.from, parsed.data.to)) {
      response.json(availabilityResponse(
        'unsupported',
        'Traseul solicitat nu este acoperit de pilotul curent.',
      ))
      return
    }

    if (!journeySearchAvailable || !providerIsReady()) {
      response.json(availabilityResponse(
        'unavailable',
        'Sursa CFR nu este activă sau nu este pregătită.',
      ))
      return
    }

    try {
      const result = await service.search({
        ...parsed.data,
        bike: true,
      } as TrainSearchCriteria)
      response.json(result)
    } catch {
      response.status(503).json({
        error: 'providers_unavailable',
        message: 'Datele despre trenuri nu sunt disponibile momentan.',
      })
    }
  })

  app.get('/api/destinations', async (request, response) => {
    response.setHeader('Cache-Control', 'private, no-store')
    const parsed = createDestinationQuerySchema(clock).safeParse(request.query)

    if (!parsed.success) {
      response.status(400).json({
        error: 'invalid_query',
        message: 'Verifică stația, data și filtrele pentru bicicletă și tren direct.',
        issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      })
      return
    }

    if (!routeIsInPilot(pilot, parsed.data.from)) {
      response.json(availabilityResponse(
        'unsupported',
        'Stația solicitată nu este acoperită de pilotul curent.',
      ))
      return
    }

    if (!destinationService || !discoveryAvailable) {
      response.json(availabilityResponse(
        'unsupported',
        'Explorarea destinațiilor nu este disponibilă în pilotul curent.',
      ))
      return
    }

    try {
      const result = await destinationService.search({
        ...parsed.data,
        bike: true,
        direct: true,
      } as DestinationSearchCriteria)
      response.json(result)
    } catch {
      response.status(503).json({
        error: 'providers_unavailable',
        message: 'Descoperirea destinațiilor nu este disponibilă momentan.',
      })
    }
  })

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'not_found', message: 'Ruta API nu există.' })
  })

  return app
}
