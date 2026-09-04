import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import express from 'express'
import { createApp } from './app.js'
import { SQLiteCacheStore } from './cache/sqlite-cache-store.js'
import { createPilotStationConfig } from './config/pilot.js'
import { CachedTrainProvider } from './providers/cached-train-provider.js'
import { CfrTrainProvider } from './providers/cfr-train-provider.js'
import { ControlledTrainProvider } from './providers/controlled-train-provider.js'
import type { TrainDataProvider } from './providers/train-data-provider.js'
import { TrainSearchService } from './services/train-search-service.js'
import { DestinationDiscoveryService } from './services/destination-discovery-service.js'

const providers: TrainDataProvider[] = []
const cfrEnabled = process.env.ENABLE_CFR_WEB_ADAPTER === 'true'
const pilot = createPilotStationConfig()
let cacheStore: SQLiteCacheStore | undefined
let cfrConfigured = false

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function optionalNonNegativeInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

// The CFR page is a public UI, not a documented API. The adapter is opt-in so
// deployments can enable it only after reviewing permission and real fixtures.
if (cfrEnabled) {
  try {
    const allowedHosts = process.env.CFR_ALLOWED_HOSTS
      ?.split(',')
      .map((host) => host.trim())
      .filter(Boolean)
    const cfrProvider = new CfrTrainProvider(
      process.env.CFR_JOURNEY_ENDPOINT,
      fetch,
      {
        allowedHosts,
        publicSourceUrl: process.env.CFR_PUBLIC_SOURCE_URL,
      },
    )
    const cachePath = path.resolve(
      process.env.CACHE_DB_PATH ?? path.join('data', 'train-cache.sqlite'),
    )
    mkdirSync(path.dirname(cachePath), { recursive: true })
    cacheStore = new SQLiteCacheStore(cachePath, { maxEntries: 2_000 })
    providers.push(
      new CachedTrainProvider(
        new ControlledTrainProvider(
          cfrProvider,
          {
            maxConcurrent: positiveInteger(process.env.CFR_MAX_CONCURRENT, 2),
            maxQueue: positiveInteger(process.env.CFR_MAX_QUEUE, 20),
            maxRequests: positiveInteger(process.env.CFR_REQUESTS_PER_MINUTE, 30),
            onEvent: (event) => console.info(JSON.stringify(event)),
          },
        ),
        { store: cacheStore, ttlMs: 60 * 60 * 1000, maxEntries: 2_000 },
      ),
    )
    cfrConfigured = true
  } catch {
    console.error(JSON.stringify({
      event: 'provider_configuration', providerId: 'cfr', outcome: 'invalid_configuration',
    }))
  }
}

const cfrReady = cfrEnabled && cfrConfigured && pilot.mappingComplete

const app = createApp(
  new TrainSearchService(providers),
  new DestinationDiscoveryService(providers),
  undefined,
  {
    pilot,
    journeySearchAvailable: cfrEnabled && cfrConfigured,
    discoveryAvailable: false,
    providerReady: () => cfrReady && providers.every(
      (provider) => provider.isReady?.() ?? true,
    ),
    rateLimit: {
      windowMs: 60_000,
      maxRequests: positiveInteger(process.env.API_REQUESTS_PER_MINUTE, 60),
    },
    trustProxy: optionalNonNegativeInteger(process.env.TRUST_PROXY_HOPS),
  },
)
const port = positiveInteger(process.env.PORT, 8787)
const distDirectory = path.resolve(process.cwd(), 'dist')

if (existsSync(path.join(distDirectory, 'index.html'))) {
  app.use(express.static(distDirectory))
  app.use((request, response, next) => {
    if (request.method !== 'GET') return next()
    response.sendFile(path.join(distDirectory, 'index.html'))
  })
}

const server = app.listen(port, () => {
  console.log(`BikeTrain API listening on http://localhost:${port}`)
})

function shutdown() {
  server.close(() => {
    cacheStore?.close()
    process.exit(0)
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
